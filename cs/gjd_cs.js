/*
 * @Descripttion: 
 * @Author: dsp
 */
/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/ui/message', 'N/record', 'N/log', 'N/ui/dialog', 'N/search', 'N/url'],
    function (runtime, message, record, log, dialog, search, url) {
        var EXPORT_OBJ = {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            saveRecord: saveRecord,
            validateInsert: validateInsert,
            validateDelete: validateDelete,
            validateLine: validateLine,
            updatePrice: updatePrice, //更新成本价格
            createXjd: createXjd, //生成询价单
            djEndApply: djEndApply, //单据终止申请
            djEndExecute: djEndExecute, //单据终止执行
            alertCheckFy: alertCheckFy, //选择费用弹框
            jumpYfksqd: jumpYfksqd, //跳转至预付款申请单
            jumpKhck: jumpKhck, //跳转至客户存款
        };

        var thisData = {}; //存储当前对象记录的数据
        var is_tj_str = ''; //是否让提交 1可以提交, -1更改货品, -2插入行, -3删除行, -4添加行

        // 页面初始化时检查是否有提交结果并显示消息
        function pageInit(context) {
            console.log('pageInit');
            thisData = context.currentRecord; //这里是估价单数据
            var item_type = 'item';
            try {
                thisData.getField({ fieldId: 'exchangerate' }).isDisabled = false;  //汇率 销售业务专员系统不让编辑 放开

                var cjz_id = thisData.getValue({ fieldId: 'createdfrom' }); //估价单的 创建自 字段 
                var gjd_id = thisData.getValue({ fieldId: 'id' }); //估价单的 自增长 字段 
                var sj_id = thisData.getValue({ fieldId: 'opportunity' }); //估价单记录的 商机字段
                console.log('cjz_id', cjz_id, 'gjd_id', gjd_id, 'sj_id', sj_id);

                var fpbh_num = thisData.getValue({ fieldId: 'custbody_gjd_invoice_number' }); //估价单 发票编号字段
                if (isEmpty(fpbh_num)) { //无发票编号 写入
                    // var this_year = new Date().getFullYear(); //当前年
                    var custbody_so_number = thisData.getValue({ fieldId: 'custbody_so_number' }); //估价单 销售合同号字段 (销售合同号是 年+子公司+客户简称+商机id拼接)
                    fpbh_num = custbody_so_number.replace(/[a-zA-Z]/g, ''); //只要年+商机ID 
                    thisData.setValue({ fieldId: 'custbody_gjd_invoice_number', value: fpbh_num }); //写入发票编号
                }

                var item_count = thisData.getLineCount({ sublistId: item_type });
                for (var i = 0; i < item_count; i++) {
                    if (/* !isEmpty(cjz_id) &&  */isEmpty(gjd_id)) { //注释掉 制作副本也要重置
                        //商机 / 制作副本 跳转过来 需要更新价格, 商机的询价后价格, 在估价单 应该是询价前价格
                        var xj_h_price = thisData.getSublistValue({ sublistId: item_type, fieldId: 'custcol_xj_h_price', line: i });
                        thisData.selectLine({ sublistId: item_type, line: i });
                        thisData.setCurrentSublistValue({ sublistId: item_type, fieldId: 'custcol_xj_res', value: '未询价' }); //设置 询价结果
                        thisData.setCurrentSublistValue({ sublistId: item_type, fieldId: 'custcol_xjd_create_id', value: '' }); //设置 询价记录id
                        if (!isEmpty(xj_h_price)) {
                            thisData.setCurrentSublistValue({ sublistId: item_type, fieldId: 'custcol_xj_q_price', value: xj_h_price }); //设置 询价前单位成本
                            thisData.setCurrentSublistValue({ sublistId: item_type, fieldId: 'custcol_xj_h_price', value: 0 }); //设置 询价后单位成本
                        }
                    }
                }

                if (isEmpty(gjd_id)) { //说明还未保存 第一次从商机创建/制作副本 设置默认关联工作流id默认值
                    thisData.setValue({ fieldId: 'custbody_gjd_gzl_id', value: 72 }); //估价单工作流审批单据关联ID 估价单工作流审批人员配置
                    thisData.setValue({ fieldId: 'custbody_gjd_zz_sp', value: 76 }); //估价单终止审批工作流关联ID
                    thisData.setValue({ fieldId: 'custbody_txn_approve_status', value: 1 }); //估价单审批状态重置 
                    thisData.setValue({ fieldId: 'custbody_inventory_confirm_status', value: '' }); //估价单库存确认状态状态重置 
                    thisData.setValue({ fieldId: 'custbody_txn_approver', value: '' }); //处理人重置 
                    thisData.setValue({ fieldId: 'custbody_dj_status', value: 1 }); //估价单单据状态重置 
                    thisData.setValue({ fieldId: 'custbody_create_user', value: runtime.getCurrentUser().id }); //估价单创建人 为当前用户

                    thisData.setValue({ fieldId: 'custbody_create_xjd_id', value: '' }); //估价单多行询价单关联id
                    thisData.setValue({ fieldId: 'custbody_create_xjd_fyid', value: '' }); //估价单多行询价单关联费用id        
                }

                if (!isEmpty(cjz_id)) { //如果存在 说明是根据系统按钮点击创建的 新建估价单
                    //停用客户和子公司字段
                    thisData.getField({ fieldId: 'entity' }).isDisabled = true;  //客户
                    thisData.getField({ fieldId: 'subsidiary' }).isDisabled = true; //子公司
                }

                thisData.getSublist({ sublistId: item_type }).getColumn({ fieldId: 'custcol_cseg_cn_cfi' }).isDisabled = true; //China Cash Flow Item 停用

                var cjz_dom = document.getElementById('createdfrom_lbl_uir_label'); //创建自字段
                if (!(cjz_dom === null)) {
                    var cjz_tr_dom = cjz_dom.parentElement.parentElement.parentElement; //3层
                    // cjz_tr_dom.style.display = "none";

                    var zy_dom = document.getElementById('tr_fg_fieldGroup1').getElementsByTagName('tbody'); //主要分组下dom
                    zy_dom[0].appendChild(cjz_tr_dom);
                }
            } catch (e) {
                log.debug('pageInit', e);
                dialog.alert({ title: '提示', message: '单据加载失败，请联系管理员。', });
            }
        }

        function fieldChanged(context) {
            console.log('fieldChanged');
            var change_field = context.fieldId; //当前改变的字段
        }

        // 保存记录时的验证逻辑
        function saveRecord(context) {
            console.log('saveRecord');
            try {
                var cjz_id = thisData.getValue({ fieldId: 'createdfrom' }); //估价单的 创建自 字段 
                var gjd_id = thisData.getValue({ fieldId: 'id' }); //估价单的 自增长 字段 
                var sj_id = thisData.getValue({ fieldId: 'opportunity' }); //估价单记录的 商机字段 

                //保存时, 需要判断是否填写完业务员库存表
                /* var itemType = 'item';
                var hpItemCount = thisData.getLineCount({ sublistId: itemType }); // 获取子列表的行数 货品明细行

                var ywy_kc_none_map = new Map(); //没有填写业务库存表的行
                for (var i = 0; i < hpItemCount; i++) {
                    var hp_type = thisData.getSublistValue({ sublistId: itemType, fieldId: 'custcol_major_category', line: i });
                    if (hp_type != 28) {//产品大类，库存货品=28
                        continue;
                    }
                    //当前货品关联业务员库存分配表id 货品-业务员 唯一
                    var ywy_kc_id = thisData.getSublistValue({ sublistId: itemType, fieldId: 'custcol18', line: i }); //业务员库存分配表
                    if (isEmpty(ywy_kc_id)) {//未填写业务员库存表
                        var kc_none_key = thisData.getSublistValue({ sublistId: itemType, fieldId: 'item', line: i });
                        var kc_none_val = thisData.getSublistValue({ sublistId: itemType, fieldId: 'item_display', line: i });
                        ywy_kc_none_map.set(kc_none_key, kc_none_val);
                    }
                }
                if (ywy_kc_none_map.size > 0) {
                    dialog.alert({ title: '错误提示', message: '当前有货品行未选择业务员库存表, 校验库存失败, 请先选择业务员库存表', });
                    return false;
                } */
                var xsdb_type = 'salesteam';
                var xsdbItemCount = thisData.getLineCount({ sublistId: xsdb_type }); // 获取子列表的行数 销售代表
                var xsdb_id = null;
                var max_contribution = 0;
                for (var i = 0; i < xsdbItemCount; i++) {
                    var contribution = thisData.getSublistValue({ sublistId: xsdb_type, fieldId: 'contribution', line: i });
                    contribution = parseFloat(contribution);
                    var employee = thisData.getSublistValue({ sublistId: xsdb_type, fieldId: 'employee', line: i });
                    if (max_contribution < contribution) {
                        max_contribution = contribution;
                        xsdb_id = employee;
                    }
                }

                var this_hp_id_arr = [], this_hp_info_arr = [];

                if (isEmpty(xsdb_id)) {
                    dialog.alert({ title: '错误提示', message: '请设置销售团队的销售代表!', });
                    return false;
                } else {
                    var itemType = 'item';
                    var hpItemCount = thisData.getLineCount({ sublistId: itemType }); // 获取子列表的行数 货品明细行

                    var ywy_kc_none = ''; //没有找到业务库存表的货品
                    for (var i = 0; i < hpItemCount; i++) {
                        var hp_type = thisData.getSublistValue({ sublistId: itemType, fieldId: 'custcol_major_category', line: i });
                        if (hp_type != 28) {//产品大类，库存货品=28
                            continue;
                        }
                        var hp_id = thisData.getSublistValue({ sublistId: itemType, fieldId: 'item', line: i });
                        var hp_name = thisData.getSublistValue({ sublistId: itemType, fieldId: 'item_display', line: i });
                        var hp_sl = thisData.getSublistValue({ sublistId: itemType, fieldId: 'quantity', line: i });

                        this_hp_id_arr.push(hp_id);
                        this_hp_info_arr.push({
                            this_hp_id: hp_id, //货品id
                            this_hp_mc: hp_name, //货品显示名称
                            this_hp_sl: hp_sl //当前数量
                        });

                        var filters = [ //查找对应的业务员库存表
                            ['custrecord_pal_item', 'ANYOF', hp_id], //货品
                            'AND', ['custrecord_pal_employee', 'ANYOF', xsdb_id] //业务员 - 销售代表
                        ];
                        var search_data = search.create({ type: 'customrecord_person_assignment_line', filters: filters, columns: ['internalid'] }); //业务员库存分配行
                        var ywy_kc_id = null;
                        search_data.run().each(function (res) {
                            ywy_kc_id = res.getValue('internalid');
                            return false; // 只取第一个匹配项 默认应该只有一个单据
                        });
                        if (isEmpty(ywy_kc_id)) {
                            ywy_kc_none += ' [' + hp_name + '] ';
                        } else {
                            thisData.selectLine({ sublistId: itemType, line: i });
                            thisData.setCurrentSublistValue({ sublistId: itemType, fieldId: 'custcol18', value: ywy_kc_id }); //设置 业务员库存表
                        }
                    }
                    if (!isEmpty(ywy_kc_none)) {
                        dialog.alert({ title: '错误提示', message: '当前货品 ' + ywy_kc_none + ' 未找到对应业务员库存表, 请联系管理员进行设置', });
                        return false;
                    }
                }

                // console.log('this_hp_info_arr', this_hp_info_arr);
                var zqk_str = checkZqkByHp(this_hp_id_arr, this_hp_info_arr, gjd_id);
                if (!isEmpty(zqk_str)) {
                    dialog.alert({ title: '错误提示', message: zqk_str });
                    return false;
                }

                return true; //默认不阻止表单提交
            } catch (e) {
                log.debug('saveRecord', e);
                dialog.alert({ title: '提示', message: '单据保存失败，请联系管理员。', });
                return false;
            }
        }

        //子列表插入验证逻辑
        function validateInsert(context) {
            console.log('validateInsert');
            return true;
        }

        //子列表删除验证逻辑
        function validateDelete(context) {
            console.log('validateDelete');
            return true;
        }

        //子列表添加逻辑
        function validateLine(context) {
            console.log('validateLine');
            return true;
        }

        //生成询价单
        function createXjd(rec_id, rec_type) {
            console.log('createXjd');
            var item_type = 'item';
            try {
                var this_record = thisData; //取页面的 才能拿到动态值
                if (isEmpty(this_record)) this_record = record.load({ type: rec_type, id: rec_id, isDynamic: true });
                var item_count = this_record.getLineCount({ sublistId: item_type }); // 获取子列表的行数 货品明细行
                for (var i = 0; i < item_count; i++) {
                    var this_hp_id = this_record.getSublistValue({ sublistId: item_type, fieldId: 'id', line: i }); //当前单据的货品行自增长id
                    // console.log('this_hp_id', this_hp_id);
                    if (isEmpty(this_hp_id)) {
                        dialog.alert({ title: '提示', message: '有操作新子行记录, 请先保存后再生成询价单' });
                        return;
                    }
                }

                var xjd_type = ['custbody_create_xjd_id', 'custbody_create_xjd_fyid'];
                var message_str = '';
                for (var i = 0; i < xjd_type.length; i++) {
                    var xjd_id = this_record.getValue({ fieldId: xjd_type[i] }); //当前单据创建的询价单主行id
                    if (!isEmpty(xjd_id)) { //有询价单 则需要在判断询价单已回写完成
                        var xjd_record = record.load({
                            type: 'customrecord_mul_xjd', //多行询价单记录类型
                            id: xjd_id,
                        });

                        var xjd_status = parseInt(xjd_record.getValue({ fieldId: 'custrecord_xjd_status' })); //询价单状态
                        // if (xjd_status != 6 && xjd_status != 1) { //已批准-4 已更新-6 待提交-1   说明已经在走流程 不让更新
                        if (xjd_status != 6) { //已批准-4 已更新-6 待提交-1   说明已经在走流程 不让更新
                            // dialog.alert({ title: 'ERROR', message: '当前询价单[' + xjd_id + ']已经在走审批流程, 请等待回写完成后再点击[生成询价单]' });
                            message_str += '当前询价单[' + xjd_id + ']已经在走审批流程, 请等待回写完成后再点击[生成询价单]' + ' <br />';

                            var xjd_status_str = '';
                            switch (xjd_status) {
                                case 1:
                                    xjd_status_str = '待提交';
                                    break;
                                case 2:
                                    xjd_status_str = '待处理';
                                    break;
                                case 3:
                                    xjd_status_str = '已处理待审批';
                                    break;
                                case 4:
                                    xjd_status_str = '已批准';
                                    break;
                                case 5:
                                    xjd_status_str = '审批中';
                                    break;
                                case 6:
                                    xjd_status_str = '已更新回写';
                                    break;
                            }
                            this_record = record.load({ type: rec_type, id: rec_id, isDynamic: true });
                            if (xjd_type[i] == 'custbody_create_xjd_id') {
                                this_record.setValue({ fieldId: 'custbody_mul_xjd_hp_status', value: '询价单' + xjd_status_str, ignoreFieldChange: true }); //记录货品询价单状态
                            } else if (xjd_type[i] == 'custbody_create_xjd_fyid') {
                                this_record.setValue({ fieldId: 'custbody_mul_xjd_fy_status', value: '询价单' + xjd_status_str, ignoreFieldChange: true }); //记录费用询价单状态
                            }
                            this_record.save();
                        } else { //去更新当前查到的询价单
                            var res = getNeedXjArr(this_record, rec_id, rec_type, xjd_type[i]);
                            if (res.code == 1) {
                                var xj_arr = res.data;
                                res = hpFyUpdateXjd(this_record, rec_id, rec_type, xj_arr, xjd_id, xjd_type[i]);
                            }
                            message_str += res['message'] + ' <br />';
                        }
                    } else { //去新建询价单
                        var res = getNeedXjArr(this_record, rec_id, rec_type, xjd_type[i]);
                        if (res.code == 1) {
                            var xj_arr = res.data;
                            res = hpFyCreateXjd(this_record, rec_id, rec_type, xjd_type[i], xj_arr);
                        }
                        message_str += res['message'] + ' <br />';
                    }
                }
                message_str += '\n点击[OK]刷新页面, 或选择不刷新';
                dialog.confirm({ title: '提示', message: message_str }).then(function (result) {
                    if (result) {
                        window.location.reload();
                    }
                });
            } catch (e) {
                log.debug('createXjd', e);
                dialog.alert({ title: 'ERROR', message: '生成询价单失败，请联系管理员。' });
            }
        }

        //获取需要询价的数组
        function getNeedXjArr(this_record, rec_id, rec_type, xjd_type_id) {
            console.log('getNeedXjArr');
            var field_map = {
                custrecord_cj_hp_id: 'id', //询价单的创建自子行ID 记录 货品行自增长id
                custrecord_hp_info: 'item', //货品信息
                custrecord_hp_sl: 'quantity', //数量
                // custrecord_sc_price: 'rate', //市场价
                custrecord_sm: 'taxcode', //税码
                custrecord_slv: 'taxrate1', //税率
                custrecord_dw: 'units', //单位
                custrecord_cpdl: 'custcol_major_category', //产品大类
                custrecord_hp_jfd: 'custcol1', //货品交付地
                custrecord_my_mdd: 'custcol_trade_destination', //贸易目的地
                custrecord_xjd_remark: 'description', //备注
                custrecord_xj_q_price: 'custcol_xj_q_price' //询价前价格
                // custrecord_xj_q_price: 'rate'
            }
            var item_type = 'item';
            try {
                var item_count = this_record.getLineCount({ sublistId: item_type }); // 获取子列表的行数 货品明细行
                var hp_xj_arr = []; //货品需要询价数组
                var fy_xj_arr = []; //费用需要询价数组
                for (var i = 0; i < item_count; i++) {
                    var hp_type = this_record.getSublistValue({ sublistId: item_type, fieldId: 'custcol_major_category', line: i }); //产品大类
                    // var hp_id = this_record.getSublistValue({ sublistId: item_type, fieldId: 'item', line: i }); //货品id 
                    var is_xj = this_record.getSublistValue({ sublistId: item_type, fieldId: 'custcol_is_xj', line: i }); //是否询价 
                    if (is_xj) { //勾选询价
                        var this_hp_id = this_record.getSublistValue({ sublistId: item_type, fieldId: 'id', line: i }); //当前单据的货品行自增长id
                        var xj_item_obj = { 'this_hp_id': this_hp_id }; //记录单据货品行自增长id 后续更新货品行记录 // var xj_item_obj = {'询价单的字段' : 估价单的值};
                        for (var xjd_item_field in field_map) {
                            var hp_field = field_map[xjd_item_field]; //当前货品行字段
                            var hp_value = this_record.getSublistValue({ sublistId: item_type, fieldId: hp_field, line: i }) || ''; //货品值

                            xj_item_obj[xjd_item_field] = hp_value;
                        }
                        if (hp_type == 28) {//产品大类，库存货品=28
                            hp_xj_arr.push(xj_item_obj);
                        } else if (hp_type == 30) {//产品大类，费用货品=30
                            fy_xj_arr.push(xj_item_obj);
                        }
                    }
                }

                if (xjd_type_id == 'custbody_create_xjd_id') {
                    if (hp_xj_arr.length == 0) {
                        return { code: -1, message: '货品行未选择需要询价的子行' };
                    }
                    return { code: 1, message: '', data: hp_xj_arr };
                    // return hpFyCreateXjd(this_record, rec_id, rec_type, xjd_type_id, hp_xj_arr);
                } else if (xjd_type_id == 'custbody_create_xjd_fyid') {
                    if (fy_xj_arr.length == 0) {
                        return { code: -1, message: '费用行未选择需要询价的子行' };
                    }
                    return { code: 1, message: '', data: fy_xj_arr };
                    // return hpFyCreateXjd(this_record, rec_id, rec_type, xjd_type_id, fy_xj_arr);
                }
            } catch (error) {
                log.debug('getNeedXjArr', error);
                return { code: -1, message: '生成询价单获取货品行值错误, 请联系管理员.' };
            }
        }

        //货品/费用生成询价单逻辑
        function hpFyCreateXjd(this_record, rec_id, rec_type, xjd_type_id, xj_arr) {
            console.log('hpFyCreateXjd');
            var item_type = 'item'; //货品行记录类型
            try {
                var custbody_main_currency = this_record.getValue({ fieldId: 'custbody_main_currency' }); //币种
                var custbody_incoterm = this_record.getValue({ fieldId: 'custbody_incoterm' }) || ''; //价格条件|国际贸易
                var salesrep = this_record.getValue({ fieldId: 'salesrep' }); //业务员 custbody_salesman 销售代表 salesrep

                //创建询价单主行信息
                var newXjdRecord = record.create({ type: 'customrecord_mul_xjd', isDynamic: true });
                newXjdRecord.setValue({ fieldId: 'custrecord_xjd_status', value: 1 }); //询价单状态 1待提交 2待处理 3已处理待审批 4已批准
                newXjdRecord.setValue({ fieldId: 'custrecord_xjd_user', value: salesrep }); //询价人
                newXjdRecord.setValue({ fieldId: 'custrecord_xjd_sp_status', value: '' }); //审批状态
                newXjdRecord.setValue({ fieldId: 'custrecord_xjd_ref_id', value: rec_id }); //表单关联ID
                newXjdRecord.setValue({ fieldId: 'custrecord_xjd_ref_type', value: rec_type }); //表单关联类型
                newXjdRecord.setValue({ fieldId: 'custrecord_xjd_currency', value: custbody_main_currency }); //币种
                newXjdRecord.setValue({ fieldId: 'custrecord_xjd_incoterm', value: custbody_incoterm }); //价格条件|国际贸易
                var newXjdRecordId = newXjdRecord.save(); //新询价单主行id
                // console.log('newXjdRecordId', newXjdRecordId);

                var this_record = record.load({ type: rec_type, id: rec_id }); //获取记录
                this_record.setValue({ fieldId: xjd_type_id, value: newXjdRecordId, ignoreFieldChange: true }); //记录询价单关联ID
                if (xjd_type_id == 'custbody_create_xjd_id') {
                    this_record.setValue({ fieldId: 'custbody_mul_xjd_hp_status', value: '已生成询价单', ignoreFieldChange: true }); //记录货品询价单状态
                } else if (xjd_type_id == 'custbody_create_xjd_fyid') {
                    this_record.setValue({ fieldId: 'custbody_mul_xjd_fy_status', value: '已生成询价单', ignoreFieldChange: true }); //记录费用询价单状态
                }
                // 循环生成明细行
                for (var i = 0; i < xj_arr.length; i++) {
                    var newXjdHpRecord = record.create({ type: 'customrecord_xjd_hp_xjh', isDynamic: true }); // 多行询价单货品行记录id
                    newXjdHpRecord.setValue({ fieldId: 'custrecord_mul_xjd_id', value: newXjdRecordId, ignoreFieldChange: true });

                    var this_hp_id = null; //需要更新货品行记录的自增长id
                    for (var field in xj_arr[i]) {
                        if (field != 'this_hp_id') {
                            newXjdHpRecord.setValue({ fieldId: field, value: xj_arr[i][field], ignoreFieldChange: true });
                        } else {
                            this_hp_id = xj_arr[i]['this_hp_id'];
                        }
                    }
                    var newXjdHpRecordId = newXjdHpRecord.save(); //新询价单主行id

                    var lineNumber = this_record.findSublistLineWithValue({ sublistId: item_type, fieldId: 'id', value: this_hp_id });
                    this_record.setSublistValue({ sublistId: item_type, fieldId: 'custcol_xj_res', value: '已询价未更新', line: lineNumber }); //设置当前子行询价状态
                    this_record.setSublistValue({ sublistId: item_type, fieldId: 'custcol_is_xj', value: true, line: lineNumber }); //设置当前子行是否询价
                    this_record.setSublistValue({ sublistId: item_type, fieldId: 'custcol_xjd_create_id', value: newXjdHpRecordId, line: lineNumber }); //记录生成的询价单货品行ID
                }
                this_record.setValue({
                    fieldId: 'custbody_txn_approve_status', //审批状态
                    value: 1, //还回去待审批, 从而隐藏提交按钮
                    ignoreFieldChange: true,
                });
                this_record.save();
                return { code: 1, message: '已生成询价单[' + newXjdRecordId + '] ' };
            } catch (error) {
                log.debug('hpFyCreateXjd', error);
                var message = '生成询价单逻辑错误, 请联系管理员.';
                if (!isEmpty(error.message)) {
                    message += ' ' + error.message;
                }
                return { code: -1, message: message };
            }
        }

        //更新当前查到的询价单
        function hpFyUpdateXjd(this_record, rec_id, rec_type, xj_arr, xjd_id, xjd_type_id) {
            console.log('hpFyUpdateXjd');
            var item_type = 'item'; //货品行记录类型
            try {
                var custbody_main_currency = this_record.getValue({ fieldId: 'custbody_main_currency' }); //币种
                var custbody_incoterm = this_record.getValue({ fieldId: 'custbody_incoterm' }) || ''; //价格条件|国际贸易
                var salesrep = this_record.getValue({ fieldId: 'salesrep' }); //业务员 custbody_salesman 销售代表 salesrep

                //获取询价单主行信息
                var xjdRecord = record.load({ type: 'customrecord_mul_xjd', id: xjd_id });
                xjdRecord.setValue({ fieldId: 'custrecord_xjd_status', value: 1 }); //重置询价单状态 1待提交 2待处理 3已处理待审批 4已批准
                xjdRecord.setValue({ fieldId: 'custrecord_xjd_user', value: salesrep }); //询价人
                xjdRecord.setValue({ fieldId: 'custrecord_xjd_sp_status', value: '' }); //审批状态重置
                xjdRecord.setValue({ fieldId: 'custrecord_xjd_currency', value: custbody_main_currency }); //更新币种
                xjdRecord.setValue({ fieldId: 'custrecord_xjd_incoterm', value: custbody_incoterm }); //更新价格条件|国际贸易

                //删除询价单子列表行
                var xjd_item_count = xjdRecord.getLineCount({ sublistId: 'recmachcustrecord_mul_xjd_id' }); // 获取询价单子列表的行数
                for (var i = 0; i < xjd_item_count; i++) {
                    xjdRecord.setSublistValue({ sublistId: 'recmachcustrecord_mul_xjd_id', fieldId: 'custrecord_update_info', value: '已生成最新记录,此行作废,只做查看,不参与回写', line: i });
                }
                xjdRecord.save();

                var this_record = record.load({ type: rec_type, id: rec_id }); //获取记录
                if (xjd_type_id == 'custbody_create_xjd_id') {
                    this_record.setValue({ fieldId: 'custbody_mul_xjd_hp_status', value: '已更新询价单', ignoreFieldChange: true }); //记录货品询价单状态
                } else if (xjd_type_id == 'custbody_create_xjd_fyid') {
                    this_record.setValue({ fieldId: 'custbody_mul_xjd_fy_status', value: '已更新询价单', ignoreFieldChange: true }); //记录费用询价单状态
                }
                // 循环生成明细行
                for (var i = 0; i < xj_arr.length; i++) {
                    var xjdHpRecord = record.create({ type: 'customrecord_xjd_hp_xjh', isDynamic: true }); // 多行询价单货品行记录id
                    xjdHpRecord.setValue({ fieldId: 'custrecord_mul_xjd_id', value: xjd_id, ignoreFieldChange: true });

                    var this_hp_id = null; //需要更新货品行记录的自增长id
                    for (var field in xj_arr[i]) {
                        if (field != 'this_hp_id') {
                            xjdHpRecord.setValue({ fieldId: field, value: xj_arr[i][field], ignoreFieldChange: true });
                        } else {
                            this_hp_id = xj_arr[i]['this_hp_id'];
                        }
                    }
                    var xjdHpRecordId = xjdHpRecord.save(); //新询价单主行id

                    var lineNumber = this_record.findSublistLineWithValue({ sublistId: item_type, fieldId: 'id', value: this_hp_id });
                    this_record.setSublistValue({ sublistId: item_type, fieldId: 'custcol_xj_res', value: '已询价未更新', line: lineNumber }); //设置当前子行询价状态
                    this_record.setSublistValue({ sublistId: item_type, fieldId: 'custcol_is_xj', value: true, line: lineNumber }); //设置当前子行是否询价
                    this_record.setSublistValue({ sublistId: item_type, fieldId: 'custcol_xjd_create_id', value: xjdHpRecordId, line: lineNumber }); //记录生成的询价单货品行ID
                }
                this_record.setValue({
                    fieldId: 'custbody_txn_approve_status', //审批状态
                    value: 1, //还回去待审批, 从而隐藏提交按钮
                    ignoreFieldChange: true,
                });
                this_record.save();
                return { code: 1, message: '已更新询价单[' + xjd_id + '] ' };
            } catch (error) {
                log.debug('hpFyUpdateXjd', error);
                var message = '更新询价单逻辑错误, 请联系管理员.';
                if (!isEmpty(error.message)) {
                    message += ' ' + error.message;
                }
                return { code: -1, message: message };
            }

        }

        //更新价格
        function updatePrice(rec_id, rec_type) {
            console.log('updatePrice');
            try {
                var this_record = record.load({ type: rec_type, id: rec_id, isDynamic: true });
                var message_str = '';
                var updatePriceStatus = 0;
                var xjwc = true; //是否询价完成
                //判断是否已经有询价单, 并且状态未回写 还在走流程 那么就需要先走完询价单流程
                var xjd_type = ['custbody_create_xjd_id', 'custbody_create_xjd_fyid'];
                for (var i = 0; i < xjd_type.length; i++) {
                    var xjd_id = this_record.getValue({ fieldId: xjd_type[i] }); //当前单据创建的询价单主行id
                    if (!isEmpty(xjd_id)) { //有询价单 则需要在判断询价单已回写完成
                        var xjd_record = record.load({ type: 'customrecord_mul_xjd', id: xjd_id }); //多行询价单记录类型

                        var xjd_status = parseInt(xjd_record.getValue({ fieldId: 'custrecord_xjd_status' })); //询价单状态
                        if (xjd_status != 6) { //已批准-4 已更新-6
                            xjwc = false; //未询价完成
                            var xjd_type_str = '';
                            if (xjd_type[i] == 'custbody_create_xjd_id') {
                                xjd_type_str = '产品';
                            } else {
                                xjd_type_str = '费用';
                            }
                            message_str += '当前单据已创建询价单, 且当前[' + xjd_type_str + ']询价单状态未询价完成, 请等待询价完成后再更新成本价格.'

                            var xjd_status_str = '';
                            switch (xjd_status) {
                                case 1:
                                    xjd_status_str = '待提交';
                                    break;
                                case 2:
                                    xjd_status_str = '待处理';
                                    break;
                                case 3:
                                    xjd_status_str = '已处理待审批';
                                    break;
                                case 4:
                                    xjd_status_str = '已批准';
                                    break;
                                case 5:
                                    xjd_status_str = '审批中';
                                    break;
                            }
                            if (xjd_type[i] == 'custbody_create_xjd_id') {
                                this_record.setValue({ fieldId: 'custbody_mul_xjd_hp_status', value: '询价单' + xjd_status_str, ignoreFieldChange: true }); //记录货品询价单状态
                            } else if (xjd_type[i] == 'custbody_create_xjd_fyid') {
                                this_record.setValue({ fieldId: 'custbody_mul_xjd_fy_status', value: '询价单' + xjd_status_str, ignoreFieldChange: true }); //记录费用询价单状态
                            }

                            // break; //终止循环 不用往后找了
                        } else {
                            var xjd_status_str = '已更新回写';
                            if (xjd_type[i] == 'custbody_create_xjd_id') {
                                this_record.setValue({ fieldId: 'custbody_mul_xjd_hp_status', value: '询价单' + xjd_status_str, ignoreFieldChange: true }); //记录货品询价单状态
                            } else if (xjd_type[i] == 'custbody_create_xjd_fyid') {
                                this_record.setValue({ fieldId: 'custbody_mul_xjd_fy_status', value: '询价单' + xjd_status_str, ignoreFieldChange: true }); //记录费用询价单状态
                            }
                        }
                    }
                }

                if (xjwc) { //需要是询价完成后 或者未创建询价单时 走后续流程
                    var custbody_main_currency = this_record.getValue({ fieldId: 'custbody_main_currency' }); //币种
                    var custbody_incoterm = this_record.getValue({ fieldId: 'custbody_incoterm' }) || 0; //价格条件|国际贸易
                    //先检索货品的价格是否都有值
                    var item_type = 'item';
                    var item_count = this_record.getLineCount({ sublistId: item_type }); // 获取子列表的行数 货品明细行
                    for (var i = 0; i < item_count; i++) {
                        var hp_id = this_record.getSublistValue({ sublistId: item_type, fieldId: 'item', line: i }); //货品id 
                        var hp_name = this_record.getSublistValue({ sublistId: item_type, fieldId: 'item_display', line: i }); //货品名称 
                        var hp_type = this_record.getSublistValue({ sublistId: item_type, fieldId: 'custcol_major_category', line: i }); //产品大类
                        message_str += '货品:' + hp_name + ' ';

                        var sp_status_field = '';
                        if (hp_type == 28) {//产品大类，库存货品=28
                            var cb_type = 'customrecord_costprice'; //产品成本价格单  
                            var filters = [
                                ['custrecord_costprice_item', 'anyof', hp_id], 'AND', //货品 
                                ['custrecord_costprice_cur', 'anyof', custbody_main_currency], 'AND', //币种
                                ['custrecord_costprice_priceitem', 'anyof', custbody_incoterm], //价格条件
                            ];
                            // var cbj_field = 'custrecord_costprice_price'; //价格
                            var cbj_field = 'custrecord_cpcb_xszdj'; //价格
                            var type_str = '产品';
                            sp_status_field = 'custrecord_approval_status';
                        } else if (hp_type == 30) { // serviceitem | otherchargeitem 运费成本价格单 不确定用哪个记录类型, 好像两个都有
                            var cb_type = 'customrecord_expense_cost'; //费用成本价格单  
                            var filters = [
                                ['custrecord_exp_cost_item', 'anyof', hp_id], 'AND', //货品 
                                ['custrecord_exp_cost_currency', 'anyof', custbody_main_currency], //币种
                            ];
                            var cbj_field = 'custrecord_exp_cost_price'; //价格
                            var type_str = '费用';
                            sp_status_field = 'custrecord_exp_cost_approval_status';
                        }

                        if (hp_type == 28 || hp_type == 30) {
                            var search_data = search.create({ type: cb_type, filters: filters, columns: ['internalid'] });
                            var cbd_id = null; //成本单id
                            search_data.run().each(function (res) {
                                cbd_id = res.getValue('internalid');
                                return false; // 只取第一个匹配项 默认应该只有一个单据
                            });

                            if (cbd_id) {
                                var this_cbd_record = record.load({ type: cb_type, id: cbd_id });
                                var cb_price = this_cbd_record.getValue({ fieldId: cbj_field }); //成本价
                                if (!isEmpty(cb_price)) {
                                    var sp_value = this_cbd_record.getValue({ fieldId: sp_status_field }); //审批状态
                                    if (sp_value != 18) { //审批通过
                                        message_str += '<b>对应' + type_str + '成本价格单的状态是未审批通过, 请等待审批通过后更新</b> <br /><br />';
                                    } else {
                                        this_record.selectLine({ sublistId: item_type, line: i });
                                        this_record.setCurrentSublistValue({ sublistId: item_type, fieldId: 'custcol_xj_q_price', value: cb_price, ignoreFieldChange: true }); //设置 询价前单位成本
                                        this_record.commitLine({ sublistId: item_type });

                                        // this_record.setSublistValue({ sublistId: item_type, fieldId: 'custcol_xj_q_price', value: cb_price, line: i }); //设置 询价前单位成本
                                        message_str += '<b>已更新对应单位成本信息 请刷新页面</b> <br /><br />';
                                        updatePriceStatus = 1; //有成功更新成本价格 标记可刷新状态
                                    }
                                } else {
                                    message_str += '<b>未设置对应' + type_str + '成本价格单的价格信息 可进入编辑模式, 点击[生成询价单]进行询价后更新成本价格</b> <br /><br />';
                                }
                            } else {
                                message_str += '<b>未找到对应' + type_str + '成本价格单 可进入编辑模式, 点击[生成询价单]进行询价后更新成本价格</b> <br /><br />';
                            }
                        } else {
                            message_str += '<b>类型未填写或不符合</b> <br /><br />';
                        }
                    }
                }
                this_record.save();
                if (updatePriceStatus == 1) {
                    dialog.confirm({ title: '提示', message: message_str }).then(function (result) {
                        window.location.reload();
                    });
                } else {
                    dialog.alert({ title: '提示', message: message_str });
                }
            } catch (e) {
                log.debug('更新成本价格失败', e);
                var message = '更新价格失败，请联系管理员。';
                if (!isEmpty(e.message)) {
                    message += ' ' + e.message;
                }
                dialog.alert({ title: 'ERROR', message: message });
            }
        }

        //单据终止申请
        function djEndApply(rec_id, rec_type) {
            dialog.confirm({
                title: '确定发起单据终止申请吗?',
                message: '点击[OK], 将发起单据终止申请, 通过此商机创建的所有估价单将被锁定, 走单据终止审批!',
            }).then(function (result) {
                if (result) {
                    try {
                        //需要查出当前关联的商机创建的所有估价单 置为单据申请终止状态
                        var this_record = thisData; //取页面的 才能拿到动态值
                        if (isEmpty(this_record)) this_record = record.load({ type: rec_type, id: rec_id, isDynamic: true });
                        var sj_id = this_record.getValue({ fieldId: 'opportunity' }); //估价单记录的 商机字段
                        var filters = [ //取出商机已经创建的估价单
                            ['opportunity', 'ANYOF', sj_id] //此商机创建
                        ];
                        var search_data = search.create({ type: 'estimate', filters: filters, columns: ['internalid'] });
                        search_data.run().each(function (res) {
                            var search_gjd_id = res.getValue('internalid');
                            var gjd_data = record.load({ type: 'estimate', id: search_gjd_id, isDynamic: true });
                            gjd_data.setValue({ fieldId: 'custbody_dj_status', value: 2, ignoreFieldChange: true }); //单据申请终止
                            gjd_data.save();

                            return true; //必须有返回值, 不然只有第一条
                        });

                        dialog.confirm({ title: '提示', message: '单据终止申请成功!' }).then(function (result) {
                            window.location.reload();
                        });
                    } catch (e) {
                        log.debug('djEndApply', e);
                        console.log('djEndApply', e);
                        dialog.alert({ title: '提示', message: '单据终止申请发起失败，请联系管理员。', });
                    }
                }
            });
        }

        //单据终止执行
        function djEndExecute(rec_id, rec_type) {
            console.log('djEndExecute');
            dialog.confirm({
                title: '确定发起单据终止执行吗?',
                message: '点击[OK], 将发起单据终止执行, 此估价单将被作废, 同时还原业务库存!',
            }).then(function (result) {
                if (result) {
                    try {
                        var this_record = record.load({ type: rec_type, id: rec_id, isDynamic: true });
                        var itemType = 'item';
                        var hpItemCount = this_record.getLineCount({ sublistId: itemType }); // 获取子列表的行数 货品明细行
                        var hy_arr = []; //需要库存还原数量的货品
                        for (var i = 0; i < hpItemCount; i++) {
                            var hp_type = this_record.getSublistValue({ sublistId: itemType, fieldId: 'custcol_major_category', line: i });
                            if (hp_type != 28) continue; //产品大类，库存货品=28

                            //当前货品关联业务员库存分配表id 货品-业务员 唯一
                            var ywy_kc_id = this_record.getSublistValue({ sublistId: itemType, fieldId: 'custcol18', line: i }); //业务员库存分配表
                            if (!isEmpty(ywy_kc_id)) {
                                var xq_hp_sl = this_record.getSublistValue({ sublistId: itemType, fieldId: 'quantity', line: i }); //当前货品数量
                                var qr_hp = {}; //确认扣减的货品
                                qr_hp.ywy_kc_id = ywy_kc_id;
                                qr_hp.xq_hp_sl = xq_hp_sl;
                                hy_arr.push(qr_hp);
                            }
                        }

                        if (hy_arr.length > 0) {
                            for (var i = 0; i < hy_arr.length; i++) {
                                var ywy_kc_id = hy_arr[i].ywy_kc_id;
                                var xq_hp_sl = hy_arr[i].xq_hp_sl;
                                //业务员库存分配行
                                var ywy_kc_data = record.load({ type: 'customrecord_person_assignment_line', id: ywy_kc_id, });

                                var ywy_kc_qrl = ywy_kc_data.getValue({ fieldId: 'custrecord_kc_qr_sl' }); //商机库存确认量
                                ywy_kc_data.setValue({ fieldId: 'custrecord_kc_qr_sl', value: ywy_kc_qrl - xq_hp_sl, ignoreFieldChange: true, }); //减少当前库存确认量 
                                ywy_kc_data.save();
                            }
                        }

                        this_record.setValue({ fieldId: 'custbody_txn_approve_status', value: 11, ignoreFieldChange: true }); //审批状态=11 已关闭 13 已作废\
                        this_record.setValue({ fieldId: 'custbody_dj_status', value: 5, ignoreFieldChange: true }); //单据已终止
                        this_record.save();

                        dialog.confirm({ title: '提示', message: '单据终止执行成功!' }).then(function (result) {
                            window.location.reload();
                        });
                    } catch (e) {
                        log.debug('djEndExecute', e);
                        dialog.alert({ title: '提示', message: '单据终止执行失败，请联系管理员。', });
                    }
                }
            });
        }

        //选择费用弹框
        function alertCheckFy(rec_id, rec_type) {
            var z_gs = thisData.getValue({ fieldId: 'subsidiary' });
            if (isEmpty(z_gs)) {
                dialog.alert({ title: '提示', message: '请先填写子公司', });
                return;
            }
            var bz = thisData.getValue({ fieldId: 'custbody_main_currency' });
            if (isEmpty(bz)) {
                dialog.alert({ title: '提示', message: '请先选择币种', });
                return;
            }
            var targetDiv = document.getElementById('div__body'); //获取目标 div 元素
            if (targetDiv) {
                var overlayDiv = document.createElement('div');//创建 overlay 容器
                overlayDiv.className = 'overlay';
                overlayDiv.id = 'iframeOverlay';
                overlayDiv.style.position = 'fixed';
                overlayDiv.style.top = '0';
                overlayDiv.style.left = '0';
                overlayDiv.style.width = '100%';
                overlayDiv.style.height = '100%';
                overlayDiv.style.background = 'rgba(0, 0, 0, 0.7)';
                overlayDiv.style.display = 'none'; // 初始时不显示
                overlayDiv.style.justifyContent = 'center';
                overlayDiv.style.alignItems = 'center';
                overlayDiv.style.zIndex = '1000';

                var iframeContainer = document.createElement('div'); //创建 iframe 容器
                iframeContainer.className = 'iframe-container';
                iframeContainer.style.position = 'relative';
                iframeContainer.style.width = '80%';
                iframeContainer.style.height = '80%';
                iframeContainer.style.background = 'white';
                iframeContainer.style.borderRadius = '10px';
                iframeContainer.style.overflow = 'hidden';
                iframeContainer.style.boxShadow = '0 0 15px rgba(0, 0, 0, 0.3)';

                var closeBtn = document.createElement('button'); //创建关闭按钮
                closeBtn.className = 'close-btn';
                closeBtn.id = 'closeIframeBtn';
                closeBtn.textContent = '关闭';
                closeBtn.style.position = 'absolute';
                // closeBtn.style.top = '10px';
                closeBtn.style.bottom = '10px';
                closeBtn.style.right = '10px';
                closeBtn.style.backgroundColor = 'red';
                closeBtn.style.color = 'white';
                closeBtn.style.border = 'none';
                closeBtn.style.padding = '10px';
                closeBtn.style.cursor = 'pointer';
                closeBtn.style.borderRadius = '5px';
                closeBtn.style.zIndex = '9';

                var iframe = document.createElement('iframe'); //创建 iframe 元素
                iframe.className = 'iframe-content';
                iframe.id = 'iframe';
                var host = url.resolveDomain({ hostType: url.HostType.APPLICATION });
                iframe.src = 'https://' + host + '/app/site/hosting/scriptlet.nl?script=1304&deploy=1&z_gs=' + z_gs + '&bz=' + bz; //弹框url
                iframe.style.width = '100%';
                iframe.style.height = '100%';
                iframe.style.border = 'none';
                iframe.style.position = 'absolute';
                iframe.style.top = '-100px';

                iframeContainer.appendChild(closeBtn); //将关闭按钮和 iframe 添加到 iframe 容器中
                iframeContainer.appendChild(iframe);
                overlayDiv.appendChild(iframeContainer); //将iframe 容器添加到 overlay 容器中
                targetDiv.appendChild(overlayDiv); //将 overlay 容器添加到目标 div 中

                closeBtn.addEventListener('click', function () { //添加关闭按钮的点击事件
                    overlayDiv.style.display = 'none'; //关闭时隐藏 overlay
                });

                function showIframeDialog() { //使用简单的方式显示 overlay
                    overlayDiv.style.display = 'flex'; // 显示弹框
                }
                showIframeDialog(); //调用 showIframeDialog 以显示 iframe 弹框

                window.addEventListener('message', function (event) {
                    if (event.origin !== ('https://' + host)) { //确保消息是从期望的来源发送的
                        console.log('非法来源，忽略消息');
                        return;
                    }
                    var selectedData = event.data; //获取 iframe 返回的数据
                    console.log('从 iframe 返回的数据:', selectedData);

                    function loopWithTimeout(item_data) {
                        var i = 0;
                        var max = item_data.length; // 循环次数
                        var delay = 1000; // 延迟时间，单位毫秒
                        function iterate() {
                            if (i < max) {
                                var hp_item_id = 'item'; //销售订单 货品明细行
                                thisData.selectNewLine({ sublistId: hp_item_id }); //添加新行

                                // thisData.setCurrentSublistValue({ sublistId: hp_item_id, fieldId: 'item', value: 8360 - i });
                                thisData.setCurrentSublistValue({ sublistId: hp_item_id, fieldId: 'item', value: item_data[i].custpage_id });
                                setTimeout(function () {
                                    // thisData.setCurrentSublistValue({ sublistId: hp_item_id, fieldId: 'taxcode', value: 6 }); //, ignoreFieldChange: true
                                    thisData.setCurrentSublistValue({ sublistId: hp_item_id, fieldId: 'rate', value: item_data[i - 1].custpage_price }); //, ignoreFieldChange: true
                                    //询价前价格一起回写
                                    thisData.setCurrentSublistValue({ sublistId: hp_item_id, fieldId: 'custcol_xj_q_price', value: item_data[i - 1].custpage_price }); //, ignoreFieldChange: true
                                    thisData.commitLine({ sublistId: hp_item_id }); //提交子列表行
                                }, 500); // 延迟 1 秒更新子列表

                                i++;
                                setTimeout(iterate, delay); // 在每次迭代后设置下一次迭代的延迟
                            } else {
                                console.log('st循环结束');
                            }
                        }
                        iterate(); // 启动循环
                    }
                    loopWithTimeout(selectedData);
                });
            }
        }

        //跳转预付款申请单
        function jumpYfksqd(rec_id, rec_type) {
            dialog.confirm({
                title: '提示',
                message: '确认提示, 点击[OK]将跳转至预付款申请单页面.',
            }).then(function (result) {
                if (result) {
                    // var host = url.resolveDomain({ hostType: url.HostType.APPLICATION });
                    var jumpUrl = url.resolveRecord({
                        recordType: 'customrecord_pay_form', //记录类型
                        recordId: null, //新建
                        isEditMode: true,
                    });

                    jumpUrl += '&cf=849&gjd_id=' + rec_id; //客户预付款申请单

                    window.open(jumpUrl, '_blank');
                }
                return true;
            });
        }

        //跳转客户存款
        function jumpKhck(rec_id, rec_type) {
            dialog.confirm({
                title: '提示',
                message: '确认提示, 点击[OK]将跳转至新建客户存款页面.',
            }).then(function (result) {
                if (result) {
                    // var host = url.resolveDomain({ hostType: url.HostType.APPLICATION });
                    //https://9632302.app.netsuite.com/app/accounting/transactions/custdep.nl
                    var jumpUrl = url.resolveRecord({
                        recordType: 'customerdeposit', //记录类型
                        recordId: null, //新建
                        isEditMode: true,
                    });

                    jumpUrl += '&gjd_id=' + rec_id; //客户预付款申请单

                    window.open(jumpUrl, '_blank');
                }
                return true;
            });
        }

        //根据货品id校验总缺口
        function checkZqkByHp(hp_id_arr, hpArr, this_gjd_id) {
            // console.log('checkZqkByHp', hp_id_arr, hpArr, this_gjd_id);
            var return_str = '';
            if (!isEmpty(hp_id_arr)) {
                //加载当前货品的采购计划批复单
                var filters = [ //是否当前货品
                    ['custrecord_plan_il_item', 'ANYOF', hp_id_arr]
                ];
                var cgjhpfd_search = search.create({ type: 'customrecord_plan_itemize_line_form', filters: filters, columns: ['custrecord_plan_il_item', 'custrecord_plan_il_approved_quantity', 'custrecord_plan_il_pos', 'custrecord_plan_il_unit_price'] });
                var cg_pfd_arr = [];
                cgjhpfd_search.run().each(function (res) { //查出所有是库存货品的货品
                    cg_pfd_arr.push({
                        hp_id: res.getValue('custrecord_plan_il_item'), //货品id
                        hp_pf_sl: res.getValue('custrecord_plan_il_approved_quantity'), //批复数量
                        pf_cg: res.getValue('custrecord_plan_il_pos'), //采购订单号
                        pf_dj: res.getValue('custrecord_plan_il_unit_price') //批复单价
                    });

                    return true; //必须有返回值, 不然只有第一条
                });
                // log.debug('cg_pfd_arr', cg_pfd_arr);

                var filters = [
                    ['internalid', 'ANYOF', hp_id_arr]
                ];
                var hp_kc_earch = search.create({ type: search.Type.ITEM, filters: filters, columns: ['internalid', 'locationquantityonhand', 'locationquantityavailable', 'locationquantitycommitted', 'locationquantityonorder'] });
                var kc_arr = [];
                hp_kc_earch.run().each(function (res) {
                    kc_arr.push({
                        hp_id: res.getValue('internalid'), //货品id
                        drk_kc: res.getValue('locationquantityonorder'), //待入库/已订购 在途
                        zk_kc: res.getValue('locationquantityonhand'), //在库库存 
                        ys_kc: res.getValue('locationquantitycommitted'), //已锁库存
                        kg_kc: res.getValue('locationquantityavailable') //可供库存
                    });

                    return true;
                });
                // log.debug('kc_arr', kc_arr);

                var filters = [ //是否当前货品的商机
                    ['item.internalid', 'ANYOF', hp_id_arr]
                    , 'AND', ['type', 'anyof', 'Opprtnty']
                    , 'AND', ['mainline', 'is', 'F']
                ];
                // var sj_search = search.create({ type: 'opportunity', filters: filters, columns: ['custbody_txn_approve_status', 'internalid'] });
                var sj_search = search.create({ type: 'transaction', filters: filters, columns: ['custbody_txn_approve_status', 'internalid', 'item', 'quantity'] });
                var sj_arr = []; //[{sj_status: 1, sj_hp_id: 8360, sj_hp_sl: 20}, {sj_status: 2, sj_hp_id: 8360, sj_hp_sl: 20}];
                sj_search.run().each(function (res) { //查出所有是库存货品的货品
                    // log.debug('sj_res', res);
                    sj_arr.push({
                        sj_status: res.getValue('custbody_txn_approve_status') || 0, //审批状态
                        sj_hp_id: res.getValue('item'), //货品id
                        sj_hp_sl: res.getValue('quantity'), //数量
                    });

                    return true; //必须有返回值, 不然只有第一条
                });
                // log.debug('sj_arr', sj_arr);

                var filters = [ //是否当前货品的估价单
                    ['item.internalid', 'ANYOF', hp_id_arr]
                    , 'AND', ['type', 'ANYOF', 'Estimate'] //首字母大写
                    , 'AND', ['mainline', 'IS', 'F']
                ];
                var gjd_search = search.create({ type: 'transaction', filters: filters, columns: ['internalid', 'item', 'quantity', 'opportunity'] });
                var gjd_arr = [];
                gjd_search.run().each(function (res) { //查出所有是库存货品的货品
                    // log.debug('gjd_arr', res);
                    if (res.getValue('internalid') != this_gjd_id) { //排除 可能查到 自己编辑的这张估价单单据
                        // gjd_arr.push({
                        //     hp_id: res.getValue('item'), //货品id
                        //     hp_sl: res.getValue('quantity'), //数量
                        // });
                        var sj_id = res.getValue('opportunity'); //商机id
                        if (!isEmpty(sj_id)) { //存在商机id 代表是商机创建的估价单
                            gjd_arr.push({
                                hp_id: res.getValue('item'), //货品id
                                hp_sl: res.getValue('quantity'), //数量
                                hp_new_sl: 0,
                            });
                        } else { //没有商机id 代表是直接新建的估价单
                            gjd_arr.push({
                                hp_id: res.getValue('item'), //货品id
                                hp_sl: 0,
                                hp_new_sl: res.getValue('quantity'), //数量
                            });
                        }
                    }

                    return true; //必须有返回值, 不然只有第一条
                });
                // log.debug('gjd_arr', gjd_arr);

                for (var i = 0; i < hpArr.length; i++) {
                    var return_info = {
                        custpage_kcb_line_id: hpArr[i].this_hp_id, //货品id
                        custpage_cp_mc: hpArr[i].this_hp_mc, //货品显示名称
                        custpage_cp_sl: hpArr[i].this_hp_sl, //货品当前数量

                        custpage_gyc_kcn: 0, //供应池-可承诺
                        custpage_gyc_ybj: 0, //供应池-已报价
                        custpage_gyc_yxd: 0, //供应池-已下单
                        custpage_gyc_zgy: 0, //供应池-总供应

                        custpage_kcc_dyk_ydg: 0, //库存池-待入库/已订购
                        custpage_kcc_zkl: 0, //库存池-在库量
                        custpage_kcc_ycn: 0, //库存池-已承诺(已锁库存)
                        custpage_kcc_kyl: 0, //库存池-可用量(可供库存)

                        custpage_xqc_yxxq: 0, //需求池-意向需求(商机的)
                        custpage_xqc_bjxq: 0, //需求池-报价需求(商机的等待报价确认)
                        custpage_xqc_ddxq: 0, //需求池-订单需求(估价单)
                        custpage_xqc_new_ddxq: 0, //需求池-订单需求(直接新建的估价单)
                        custpage_xqc_zxq: 0, //需求池-总需求

                        custpage_zqk: 0, //总缺口
                    };

                    //组装供应数据
                    for (var j = 0; j < cg_pfd_arr.length; j++) {
                        if (hpArr[i].this_hp_id == cg_pfd_arr[j].hp_id) {
                            if (isEmpty(cg_pfd_arr[j].pf_dj)) {
                                return_info.custpage_gyc_kcn += parseFloat(cg_pfd_arr[j].hp_pf_sl || 0);
                            } else {
                                return_info.custpage_gyc_ybj += parseFloat(cg_pfd_arr[j].hp_pf_sl || 0);
                            }
                            if (!isEmpty(cg_pfd_arr[j].pf_cg)) {
                                return_info.custpage_gyc_yxd += parseFloat(cg_pfd_arr[j].hp_pf_sl || 0);
                            }
                        }
                    }

                    //组装库存数据
                    for (var j = 0; j < kc_arr.length; j++) {
                        if (hpArr[i].this_hp_id == kc_arr[j].hp_id) {
                            return_info.custpage_kcc_dyk_ydg += parseFloat(kc_arr[j].drk_kc || 0);
                            return_info.custpage_kcc_zkl += parseFloat(kc_arr[j].zk_kc || 0);
                            return_info.custpage_kcc_ycn += parseFloat(kc_arr[j].ys_kc || 0);
                            return_info.custpage_kcc_kyl += parseFloat(kc_arr[j].kg_kc || 0);
                        }
                    }

                    //组装需求商机数据
                    for (var j = 0; j < sj_arr.length; j++) {
                        if (hpArr[i].this_hp_id == sj_arr[j].sj_hp_id) {
                            if (sj_arr[j].sj_status == 1 || sj_arr[j].sj_status == 0) { //待审批的商机
                                return_info.custpage_xqc_bjxq += parseFloat(sj_arr[j].sj_hp_sl || 0);
                            }
                            return_info.custpage_xqc_yxxq += parseFloat(sj_arr[j].sj_hp_sl || 0);
                        }
                    }

                    //组装需求估价单数据
                    for (var j = 0; j < gjd_arr.length; j++) {
                        if (hpArr[i].this_hp_id == gjd_arr[j].hp_id) {
                            return_info.custpage_xqc_ddxq += parseFloat(gjd_arr[j].hp_sl || 0);
                            return_info.custpage_xqc_new_ddxq += parseFloat(gjd_arr[j].hp_new_sl || 0);
                        }
                    }

                    //计算总缺口
                    var zgy = return_info.custpage_gyc_kcn + return_info.custpage_gyc_ybj;// + return_info.custpage_gyc_yxd
                    return_info.custpage_gyc_zgy = zgy;
                    // var zxq = return_info.custpage_xqc_yxxq;// + return_info.custpage_xqc_ddxq(已在商机包含);// + return_info.custpage_xqc_bjxq(不同状态的商机) 
                    return_info.custpage_xqc_zxq = return_info.custpage_xqc_ddxq + return_info.custpage_xqc_new_ddxq;//已经有的商机转换的估价单 加上 直接新建的估价单需求

                    return_info.custpage_zqk = zxq + return_info.custpage_cp_sl - zgy - return_info.custpage_kcc_kyl;//总需求 - 总供应 - 可用量 + 当前自己 排除 的 数量

                    if (return_info.custpage_zqk > 0) { //说明有缺口
                        return_str += '货品[' + return_info.custpage_cp_mc + '] 缺口数量:' + return_info.custpage_zqk + '   ';
                    }
                }
            }
            return return_str;
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

        return EXPORT_OBJ;  // 导出函数对象
    });
