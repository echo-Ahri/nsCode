/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/file', 'N/log', 'N/runtime', 'N/url', 'N/record', 'N/search', 'N/redirect'], (file, log, runtime, url, record, search, redirect) => {
    const beforeLoad = (context) => {
        //获取当前页面模式
        var pageMode = context.type;
        //获取登录用户的角色
        var currentUser = runtime.getCurrentUser();
        var currentRoleId = currentUser.role;

        var form = context.form;

        form.removeButton('createcashsale'); //默认删除现金销售
        form.removeButton('createinvoice'); //默认删除发票
        form.removeButton('narrativeButton'); //默认删除生成汇总

        var rec = context.newRecord; //当前打开的记录
        var rec_id = rec.id; //当前记录的id
        var rec_type = rec.type; //记录的类型

        var approveStatus = rec.getValue('custbody_txn_approve_status'); //审批状态
        var dj_status = rec.getValue('custbody_dj_status'); //单据状态
        approveStatus = parseInt(approveStatus);

        //加载客户端脚本文件（已定义按钮需要调用的函数）
        var fileObj = file.load({
            id: 'SuiteScripts/dsp_scripts/cs/gjd_cs.js',
        });
        form.clientScriptFileId = fileObj.id;

        if (approveStatus != 22 || (currentRoleId != 1917 && currentRoleId != 3) /*  || inventoryConfirmStatus != 3 */) { //1917 订单支持专员 3 管理员
            form.removeButton('createsalesord'); //不是客户确认PI-22 都删除 销售订单
        }

        //添加生成询价单按钮
        var create_xjd_status = [1, 24];//待审批, 询价完成  单据状态正常
        if (pageMode == 'edit' && !isEmpty(rec_id) && (create_xjd_status.includes(approveStatus) || isEmpty(approveStatus)) && dj_status == 1) {
            form.addButton({
                id: 'custpage_gjd_create_xjd_btn',
                label: '[生成询价单]',
                functionName: 'createXjd(' + rec_id + ',"' + rec_type + '")',
            });
        }
        //添加更新成本价格按钮
        var update_price_status = [1, 24];//待审批, 询价完成  单据状态正常
        if (!isEmpty(rec_id) && (update_price_status.includes(approveStatus) || isEmpty(approveStatus)) && dj_status == 1) {
            form.addButton({
                id: 'custpage_gjd_update_price_btn',
                label: '[更新成本价格]',
                functionName: 'updatePrice(' + rec_id + ',"' + rec_type + '")',
            });
        }
        //检索是否询价完成, 变更审批状态
        //待审批,询价完成(可能询价完成显示提交按钮后,用户又点击生成询价单,导致询价单更新,但提交按钮还在)
        // log.debug('pageMode', pageMode);
        if (pageMode == 'view' && !isEmpty(rec_id) && (approveStatus == 1 || approveStatus == 24) && dj_status == 1) { //增加单据正常状态
            check_xjwc(rec_id, rec_type, approveStatus);
        }

        var dj_status = rec.getValue('custbody_dj_status'); //单据状态

        if (!isEmpty(rec_id) && dj_status == 1) { //单据正常状态 可以申请终止
            form.addButton({
                id: 'custpage_gjd_zzsq_btn',
                label: '[单据终止申请]',
                functionName: 'djEndApply(' + rec_id + ',"' + rec_type + '")',
            });
        }

        if (!isEmpty(rec_id) && dj_status == 4) { //单据终止审批通过 可以申请终止执行
            form.addButton({
                id: 'custpage_gjd_zzzx_btn',
                label: '[单据终止执行]',
                functionName: 'djEndExecute(' + rec_id + ',"' + rec_type + '")',
            });
        }

        if (pageMode == context.UserEventType.EDIT && dj_status == 1) { //是编辑模式 才可以打开弹框
            form.addButton({
                id: 'custpage_alert_fy_btn',
                label: '[选择费用]',
                functionName: 'alertCheckFy(' + rec_id + ',"' + rec_type + '")',
            });
        }

        /* form.addButton({
            id: 'custpage_gjd_jump_yfksqd_btn',
            label: '[预付款申请单]',
            functionName: 'jumpYfksqd(' + rec_id + ',"' + rec_type + '")',
        }); */

        if (!isEmpty(rec_id) && dj_status == 1) {
            form.addButton({
                id: 'custpage_gjd_jump_khck_btn',
                label: '[客户存款]',
                functionName: 'jumpKhck(' + rec_id + ',"' + rec_type + '")',
            });
        }
    };

    // 是否询价完成 询价完成则修改审批状态至 询价完成 24 显示提交审核按钮, 否则不做操作
    function check_xjwc(rec_id, rec_type, sp_tatus) {
        var xjwc = true; //是否询价完成
        var this_record = record.load({ type: rec_type, id: rec_id });

        //先检索货品的价格是否都有值
        var item_type = 'item';
        var item_count = this_record.getLineCount({ sublistId: item_type }); // 获取子列表的行数 货品明细行

        for (var i = 0; i < item_count; i++) {
            var q_price = this_record.getSublistValue({ sublistId: item_type, fieldId: 'custcol_xj_q_price', line: i });
            var h_price = this_record.getSublistValue({ sublistId: item_type, fieldId: 'custcol_xj_h_price', line: i });
            if ((isEmpty(q_price) || q_price === 0) && (isEmpty(h_price) || h_price === 0)) {
                xjwc = false; //没有价格 必须先询价
                break;
            }
        }
        // log.debug('xjwc1', xjwc);
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
                    // log.debug('xjd_status', xjd_status);
                    if (xjd_status != 6) { //已批准-4 已更新-6
                        xjwc = false; //未询价完成
                        break; //终止循环 不用往后找了
                    }
                }
            }
        }
        // log.debug('xjwc2', xjwc);
        if (xjwc) { //询价完成 更改状态, 可显示提交审核按钮
            if (sp_tatus != 24) { //增加已经是 24询价完成状态 不用继续执行更改记录
                this_record.setValue({
                    fieldId: 'custbody_txn_approve_status', //审批状态
                    value: 24,
                    ignoreFieldChange: true,
                });
                this_record.save();

                redirect.toRecord({ type: rec_type, id: rec_id }); //更改状态后 自动刷新
            }
        } else {
            if (sp_tatus == 24) {
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

    function afterSubmit(context) {
        //提交后, 根据货品 添加业务员库存表
        var rec = context.newRecord; //当前打开的记录
        var rec_id = rec.id; //当前记录的id
        var rec_type = rec.type; //记录的类型
        var gjdRecord = record.load({ type: rec_type, id: rec_id });
        var yg_id = gjdRecord.getValue({ fieldId: 'salesrep' }); //销售代表
        var itemType = 'item';
        var hpItemCount = gjdRecord.getLineCount({ sublistId: itemType }); // 获取子列表的行数 货品明细行
        for (var i = 0; i < hpItemCount; i++) {
            var hp_type = gjdRecord.getSublistValue({ sublistId: itemType, fieldId: 'custcol_major_category', line: i });
            if (hp_type != 28) {//产品大类，库存货品=28
                continue;
            }
            var hp_item_id = gjdRecord.getSublistValue({ sublistId: itemType, fieldId: 'item', line: i });

            try {
                var filters = [ //是否有对应的估价单业务员库存表
                    ['custrecord_ywykcb_gjd_id', 'ANYOF', rec_id],
                    'AND', ['custrecord_ywykcb_hp_id', 'ANYOF', hp_item_id]
                ];
                var search_data = search.create({ type: 'customrecord_gjd_ywy_kcb', filters: filters, columns: ['internalid'] });
                var gjd_ywykcb_id = null;
                search_data.run().each(function (search_res) { //查询当前
                    gjd_ywykcb_id = search_res.getValue('internalid');
                    return false;
                });
                if (isEmpty(gjd_ywykcb_id)) {
                    var filters = [ //是否有当前货品+业务员的库存分配行
                        ['custrecord_pal_item', 'ANYOF', hp_item_id],
                        'AND', ['custrecord_pal_employee', 'ANYOF', yg_id]
                    ];
                    var search_data = search.create({ type: 'customrecord_person_assignment_line', filters: filters, columns: ['internalid'] });
                    var kcfph_id = null;
                    search_data.run().each(function (search_res) { //查询当前
                        kcfph_id = search_res.getValue('internalid');
                        return false;
                    });
                    if (!isEmpty(kcfph_id)) { //有对应的
                        var newXjdRecord = record.create({ type: 'customrecord_gjd_ywy_kcb', isDynamic: true }); //添加一行估价单业务员库存表
                        newXjdRecord.setValue({ fieldId: 'custrecord_ywykcb_gjd_id', value: rec_id }); //估价单关联ID
                        newXjdRecord.setValue({ fieldId: 'custrecord_ywykcb_id', value: kcfph_id }); //业务员库存表关联ID
                        newXjdRecord.save();
                    }
                }
            } catch (e) {
                log.error('afterSubmit_for_i_' + i, e);
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
    return { beforeLoad, afterSubmit };
});
