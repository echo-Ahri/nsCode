/*
 * @Descripttion: 
 * @Author: dsp
 */
/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/ui/message', 'N/record', 'N/log', 'N/ui/dialog', 'N/url', 'N/search'],
    function (runtime, message, record, log, dialog, url, search) {
        var EXPORT_OBJ = {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            createXjd: createXjd, //生成询价单
            updatePrice: updatePrice, //更新价格
            saveRecord: saveRecord, //更新价格
        };

        var thisData = {}; //存储当前对象记录的数据

        // 页面初始化时检查是否有提交结果并显示消息
        function pageInit(context) {
            thisData = context.currentRecord;
            console.log('pageInit');

            var c_gjd_dom = document.getElementById('tbl_createestimate'); //新建估价单按钮
            if (!(c_gjd_dom === null)) {
                c_gjd_dom.parentElement.style.display = "none";
            }

            thisData.getField({ fieldId: 'currency' }).isDisabled = true;  //货币
            thisData.getField({ fieldId: 'exchangerate' }).isDisabled = true;  //汇率

            var customform = thisData.getValue({ fieldId: 'customform' });
            console.log('customform', customform);
            if (customform == 225) {
                var custbody_main_currency = thisData.getValue({ fieldId: 'custbody_main_currency' });
                thisData.setValue({ fieldId: 'currency', value: custbody_main_currency });

                var sj_id = thisData.getValue({ fieldId: 'id' }); //商机的 自增长 字段 
                var tranid = thisData.getValue({ fieldId: 'tranid' }); //商机的 估价单号
                console.log('sj_id', sj_id, 'tranid', tranid);
                if (isEmpty(sj_id) && tranid == '待生成') { //制作副本
                    thisData.setValue({ fieldId: 'custbody_create_xjd_id', value: '' });
                    thisData.setValue({ fieldId: 'custbody_create_xjd_fyid', value: '' });
                    thisData.setValue({ fieldId: 'custbody49', value: '' });
                    thisData.setValue({ fieldId: 'custbody_txn_approve_status', value: '' });
                    thisData.setValue({ fieldId: 'custbody_inventory_confirm_status', value: '' });
                    thisData.setValue({ fieldId: 'memo', value: '' });
                    thisData.setValue({ fieldId: 'custbody28', value: '' }); //处理人

                    setTimeout(function () { updateItem(); }, 1000); // 延迟 1 秒更新子列表
                }
            }

            /* var custbody_hci_sales_type = thisData.getValue({ fieldId: 'custbody_hci_sales_type' }); //销售类型
            var custbody_incoterm = thisData.getField({ fieldId: 'custbody_incoterm' }); //国际贸易
            if (custbody_hci_sales_type == 2) { //外贸
                custbody_incoterm.isMandatory = true;
            } else {
                custbody_incoterm.isMandatory = false;
            } */
        }

        function updateItem() {
            console.log('updateItem');
            var item_type = 'item';
            var item_count = thisData.getLineCount({ sublistId: item_type });
            for (var i = 0; i < item_count; i++) {
                thisData.selectLine({ sublistId: item_type, line: i });
                thisData.setCurrentSublistValue({ sublistId: item_type, fieldId: 'custcol_xj_res', value: '未询价' }); //设置 询价结果
                thisData.setCurrentSublistValue({ sublistId: item_type, fieldId: 'custcol_xjd_create_id', value: '' }); //设置 询价记录id
            }
        }

        function fieldChanged(context) {
            // console.log('fieldChanged');
            var change_field = context.fieldId; //当前改变的字段
            console.log('change_field', change_field);
            if (change_field == 'custbody_main_currency') {
                var custbody_main_currency = thisData.getValue({ fieldId: 'custbody_main_currency' });
                thisData.setValue({ fieldId: 'currency', value: custbody_main_currency });

                // var custbody_main_exchange_rate = thisData.getValue({ fieldId: 'custbody_main_exchange_rate' });
                // thisData.setValue({ fieldId: 'exchangerate', value: custbody_main_exchange_rate });
            }/*  else if (change_field == 'custbody_hci_sales_type') {
                var custbody_hci_sales_type = thisData.getValue({ fieldId: 'custbody_hci_sales_type' });
                var custbody_incoterm = thisData.getField({ fieldId: 'custbody_incoterm' });
                if (custbody_hci_sales_type == 2) { //外贸
                    custbody_incoterm.isMandatory = true;
                } else {
                    custbody_incoterm.isMandatory = false;
                }
            } */
        }

        // 保存记录时的验证逻辑
        function saveRecord(context) {
            var kh_id = thisData.getValue({ fieldId: 'entity' });
            var filters = [
                ['isinactive', 'IS', 'F']
                , 'AND', ['internalid', 'ANYOF', kh_id]
                , 'AND', ['stage', 'ANYOF', ['PROSPECT', 'CUSTOMER']]
            ];

            var search_data = search.create({ type: 'customer', filters: filters, columns: ['internalid', 'custentity33', 'stage'] });
            var is_save = false;
            var stage_str = '客户';
            search_data.run().each(function (res) {
                var custentity33 = res.getValue('custentity33');
                if (custentity33 == 7 || custentity33 == 10) {
                    is_save = true;
                } else {
                    var stage = res.getValue('stage');
                    console.log('stage', stage);
                    if (stage == 'PROSPECT') {
                        stage_str = '潜在客户';
                    }
                }
            });
            if (!is_save) {
                dialog.alert({ title: '提示', message: '商机|估价单保存的客户的审批状态必须是审核通过的潜在客户和客户, 当前选择的客户阶段是[' + stage_str + '], 且审批未通过!' });
                return false;
            } else {
                return true;
            }
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
                var custbody_salesman = this_record.getValue({ fieldId: 'custbody_salesman' }); //业务员 custbody_salesman 销售代表 salesrep

                //创建询价单主行信息
                var newXjdRecord = record.create({ type: 'customrecord_mul_xjd', isDynamic: true });
                newXjdRecord.setValue({ fieldId: 'custrecord_xjd_status', value: 1 }); //询价单状态 1待提交 2待处理 3已处理待审批 4已批准
                newXjdRecord.setValue({ fieldId: 'custrecord_xjd_user', value: custbody_salesman }); //询价人
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
                var custbody_salesman = this_record.getValue({ fieldId: 'custbody_salesman' }); //业务员 custbody_salesman 销售代表 salesrep

                //获取询价单主行信息
                var xjdRecord = record.load({ type: 'customrecord_mul_xjd', id: xjd_id });
                xjdRecord.setValue({ fieldId: 'custrecord_xjd_status', value: 1 }); //重置询价单状态 1待提交 2待处理 3已处理待审批 4已批准
                xjdRecord.setValue({ fieldId: 'custrecord_xjd_user', value: custbody_salesman }); //询价人
                xjdRecord.setValue({ fieldId: 'custrecord_xjd_sp_status', value: '' }); //审批状态重置
                xjdRecord.setValue({ fieldId: 'custrecord_xjd_currency', value: custbody_main_currency }); //更新币种
                xjdRecord.setValue({ fieldId: 'custrecord_xjd_incoterm', value: custbody_incoterm }); //更新价格条件|国际贸易

                //删除询价单子列表行
                var xjd_item_count = xjdRecord.getLineCount({ sublistId: 'recmachcustrecord_mul_xjd_id' }); // 获取询价单子列表的行数
                for (var i = 0; i < xjd_item_count; i++) {
                    // xjdRecord.removeLine({ sublistId: 'recmachcustrecord_mul_xjd_id', line: i, ignoreRecalc: true }); //SSS_INVALID_SUBLIST_OPERATION 报错
                    /* var xjd_item_id = xjdRecord.getSublistValue({ sublistId: 'recmachcustrecord_mul_xjd_id', fieldId: 'id', line: i });
                    // record.delete({ type: 'customrecord_xjd_hp_xjh', id: xjd_item_id }); //无法删除当前还挂载在商机单据上的一行
                    var xjd_old_item = record.load({ type: 'customrecord_xjd_hp_xjh', id: xjd_item_id });
                    xjd_old_item.setValue({ fieldId: 'isinactive', value: true });
                    xjd_old_item.save(); */

                    xjdRecord.setSublistValue({ sublistId: 'recmachcustrecord_mul_xjd_id', fieldId: 'custrecord_update_info', value: '已生成最新记录,此行作废,只做查看,不参与回写', line: i }); //
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
                        // console.log('hp_type', hp_type);
                        message_str += '货品:' + hp_name + ' ';

                        var sp_status_field = '';
                        if (hp_type == 28) {//产品大类，库存货品=28
                            var cb_type = 'customrecord_costprice'; //产品成本价格单  
                            var filters = [
                                ['custrecord_costprice_item', 'anyof', hp_id], 'AND', //货品 
                                ['custrecord_costprice_cur', 'anyof', custbody_main_currency], 'AND', //币种
                                ['custrecord_costprice_priceitem', 'anyof', custbody_incoterm], //价格条件
                            ];
                            // console.log('filters', filters);
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

                            /* // var this_cbd_record = record.load({type: 'serviceitem', id: hp_id});
                            var this_cbd_record = record.load({ type: 'otherchargeitem', id: hp_id });
         
                            var cb_price = this_cbd_record.getValue({ fieldId: 'custitem_unified_price' }); //成本价
                            if (!isEmpty(cb_price)) {
                                this_record.setSublistValue({ sublistId: item_type, fieldId: 'custcol_xj_q_price', value: cb_price, line: i }); //设置 询价前单位成本
                                message_str += '<b>已更新对应单位成本信息 请刷新页面</b> <br /><br />';
                            } else {
                                message_str += '<b>未设置对应运费成本价格单的价格信息 可点击[生成询价单]进行询价后更新成本价格</b> <br /><br />';
                            } */
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
