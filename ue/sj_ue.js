/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/file', 'N/log', 'N/runtime', 'N/url', 'N/record', 'N/redirect'], (file, log, runtime, url, record, redirect) => {
    const beforeLoad = (context) => {
        //获取当前页面模式
        var pageMode = context.type;
        //获取登录用户的角色
        var currentUser = runtime.getCurrentUser();
        var currentRoleId = currentUser.role;

        var form = context.form;

        var rec = context.newRecord; //当前打开的记录
        var rec_id = rec.id; //当前记录的id
        var rec_type = rec.type; //记录的类型

        var approveStatus = rec.getValue('custbody_txn_approve_status'); //审批状态 1待审批 21客户确认报价单
        var inventoryConfirmStatus = rec.getValue('custbody_inventory_confirm_status'); //库存确认状态 待发起 1, 已发起 2, 已确认 3, 待核对 4, 已核对 5

        //加载客户端脚本文件（已定义按钮需要调用的函数）
        var fileObj = file.load({
            id: 'SuiteScripts/dsp_scripts/cs/sj_cs.js',
        });
        form.clientScriptFileId = fileObj.id;

        //添加生成询价单按钮 增加编辑时条件 才能生成
        var create_xjd_status = [1, 24];//待审批, 客户确认报价单 21, , 询价完成
        approveStatus = parseInt(approveStatus);
        if (pageMode == 'edit' && !isEmpty(rec_id) && (create_xjd_status.includes(approveStatus) || isEmpty(approveStatus))) {
            form.addButton({
                id: 'custpage_sj_create_xjd_btn',
                label: '[生成询价单]',
                functionName: 'createXjd(' + rec_id + ',"' + rec_type + '")',
            });
        }
        //添加更新成本价格按钮
        var update_price_status = [1, 24];//待审批, 客户确认报价单 , 21, 询价完成
        if (!isEmpty(rec_id) && (update_price_status.includes(approveStatus) || isEmpty(approveStatus))) {
            form.addButton({
                id: 'custpage_sj_update_price_btn',
                label: '[更新成本价格]',
                functionName: 'updatePrice(' + rec_id + ',"' + rec_type + '")',
            });
        }
        //检索是否询价完成, 变更审批状态 增加查看时 才去刷新状态
        //客户确认报价单21 ,询价完成24(可能询价完成显示提交按钮后,用户又点击生成询价单,导致询价单更新,但提交按钮还在)
        if (pageMode == 'view' && !isEmpty(rec_id) && (approveStatus == 1 || approveStatus == 21 || approveStatus == 24)) { // inventoryConfirmStatus == 2 && 
            check_xjwc(rec_id, rec_type, approveStatus);
        }
    };

    // 是否询价完成 询价完成则修改审批状态至 询价完成 24 显示提交审核按钮, 否则不做操作
    function check_xjwc(rec_id, rec_type, sp_tatus) {
        var xjwc = true; //是否询价完成
        var this_record = record.load({ type: rec_type, id: rec_id, });

        //先检索货品的价格是否都有值
        var item_type = 'item';
        var item_count = this_record.getLineCount({ sublistId: item_type }); // 获取子列表的行数 货品明细行
        // log.debug('item_count', {'this_record':this_record, 'item_count':item_count }); return
        for (var i = 0; i < item_count; i++) {
            var q_price = this_record.getSublistValue({ sublistId: item_type, fieldId: 'custcol_xj_q_price', line: i });
            var h_price = this_record.getSublistValue({ sublistId: item_type, fieldId: 'custcol_xj_h_price', line: i });
            if ((isEmpty(q_price) || q_price === 0) && (isEmpty(h_price) || h_price === 0)) {
                xjwc = false; //没有价格 必须先询价
                break;
            }
        }

        //再校验是否有询价单, 无询价单 可直接去设置询价完成状态了
        if (xjwc) {
            var xjd_type = ['custbody_create_xjd_id', 'custbody_create_xjd_fyid'];
            for (var i = 0; i < xjd_type.length; i++) {
                var xjd_id = this_record.getValue({ fieldId: xjd_type[i] }); //当前单据创建的询价单主行id
                if (!isEmpty(xjd_id)) { //有询价单 则需要在判断询价单已回写完成
                    var xjd_record = record.load({
                        type: 'customrecord_mul_xjd', //多行询价单记录类型
                        id: xjd_id,
                    });

                    var xjd_status = xjd_record.getValue({ fieldId: 'custrecord_xjd_status' }); //询价单状态
                    if (xjd_status != 6) { //已批准-4 已更新-6
                        xjwc = false; //未询价完成
                        break; //终止循环 不用往后找了
                    }
                }
            }
        }

        if (xjwc) { //询价完成 更改状态, 可显示提交审核按钮
            if (sp_tatus == 1) { //增加已经是 24询价完成状态 不用继续执行更改记录
                this_record.setValue({
                    fieldId: 'custbody_txn_approve_status', //审批状态
                    value: 24,
                    ignoreFieldChange: true,
                });
                this_record.save();

                redirect.toRecord({ type: rec_type, id: rec_id }); //更改状态后 自动刷新
            }
        } else {
            if (sp_tatus == 24 || sp_tatus == 21) {
                this_record.setValue({
                    fieldId: 'custbody_txn_approve_status', //审批状态
                    value: 1, //还回去待审批, 从而隐藏提交按钮
                    ignoreFieldChange: true,
                });
                this_record.save();

                // redirect.toRecord({ type: rec_type, id: rec_id }); //更改状态后 自动刷新
            }
        }
    }

    //判空工具
    function isEmpty(a) {
        if (a === "") return true; //检验空字符串
        if (a === "null") return true; //检验字符串类型的null
        if (a === "undefined") return true; //检验字符串类型的 undefined
        if (!a && a !== 0 && a !== "") return true; //检验 undefined 和 null           
        if (Array.prototype.isPrototypeOf(a) && a.length === 0) return true; //检验空数组
        if (Object.prototype.isPrototypeOf(a) && Object.keys(a).length === 0) return true; //检验空对象
        return false;
    }
    return { beforeLoad };
});
