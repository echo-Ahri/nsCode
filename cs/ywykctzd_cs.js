/*
 * @Descripttion: 
 * @Author: dsp
 */
/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/ui/message', 'N/record', 'N/log', 'N/ui/dialog', 'N/search', 'N/format'],
    function (runtime, message, record, log, dialog, search, format) {
        var EXPORT_OBJ = {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            updateKcTz: updateKcTz, //更新业务员库存
        };

        var thisData = {}; //存储当前对象记录的数据

        // 页面初始化时检查是否有提交结果并显示消息
        function pageInit(context) {
            console.log('pageInit');
            thisData = context.currentRecord; //这里是估价单数据
        }

        function fieldChanged(context) {
            console.log('fieldChanged');
            var change_field = context.fieldId; //当前改变的字段
            if (change_field == 'custrecord_sia_line_to_user') { //修改调入人
                var xq_hp_id = thisData.getCurrentSublistValue({ sublistId: 'recmachcustrecord_sia_line_main', fieldId: 'custrecord_sia_line_item' });
                if (!isEmpty(xq_hp_id)) {
                    var xqr_id = thisData.getCurrentSublistValue({ sublistId: 'recmachcustrecord_sia_line_main', fieldId: 'custrecord_sia_line_to_user' });
                    var month_one_day = getMonthOneDay();
                    var filters = [
                        ['isinactive', 'IS', 'F']
                        , 'AND', ['custrecord_tfl_item', 'ANYOF', xq_hp_id] //需求货品
                        , 'AND', ['custrecord_tfl_to_employee', 'ANYOF', xqr_id] //调入人
                        , 'AND', ['created', 'ONORAFTER', month_one_day] //当月1号凌晨零点
                    ];
                    var search_data = search.create({ type: 'customrecord_transfer_from_line', filters: filters, columns: ['internalid', 'custrecord_tfl_need_amount'] });
                    var xql = 0;
                    search_data.run().each(function (res) {
                        xql = res.getValue('custrecord_tfl_need_amount');
                        return false;
                    });
                    console.log('xql', xql);
                    thisData.setCurrentSublistValue({ sublistId: 'recmachcustrecord_sia_line_main', fieldId: 'custrecord_ywy_xql', value: xql });
                }
            }
        }

        //更新业务员库存
        function updateKcTz(rec_id, rec_type) {
            console.log('updateKcTz');
            try {
                var this_record = thisData; //取页面的 才能拿到动态值
                if (isEmpty(this_record)) this_record = record.load({ type: rec_type, id: rec_id, isDynamic: true });

                var custrecord_sia_type = this_record.getValue({ fieldId: 'custrecord_sia_type' }); //调整类型 1交易调整 2需求调整 3贸易库存调整 4固定分配 5调拨

                var item_type = 'recmachcustrecord_sia_line_main';
                var item_count = this_record.getLineCount({ sublistId: item_type }); // 获取子列表的行数 业务员库存调整单行

                var message_str = '';
                var is_status = 0; //是否可以执行更新库存
                var update_arr = [];
                for (var i = 0; i < item_count; i++) {
                    var hp_id = this_record.getSublistValue({ sublistId: item_type, fieldId: 'custrecord_sia_line_item', line: i }); //货品id 
                    var hp_name = this_record.getSublistValue({ sublistId: item_type, fieldId: 'custrecord_sia_line_item_display', line: i }); //货品名称 
                    var tz_num = this_record.getSublistValue({ sublistId: item_type, fieldId: 'custrecord_sia_line_adjust_count', line: i }); //调整数量 

                    var dc_user_id = this_record.getSublistValue({ sublistId: item_type, fieldId: 'custrecord_sia_line_from_user', line: i }); //调出人
                    var dc_user_name = this_record.getSublistValue({ sublistId: item_type, fieldId: 'custrecord_sia_line_from_user_display', line: i }); //调出人
                    var dc_kcb_id = this_record.getSublistValue({ sublistId: item_type, fieldId: 'custrecord_sia_line_from_table', line: i }); //调出人库存表

                    var dr_user_id = this_record.getSublistValue({ sublistId: item_type, fieldId: 'custrecord_sia_line_to_user', line: i }); //调入人
                    var dr_user_name = this_record.getSublistValue({ sublistId: item_type, fieldId: 'custrecord_sia_line_to_user_display', line: i }); //调入人
                    var dr_kcb_id = this_record.getSublistValue({ sublistId: item_type, fieldId: 'custrecord_sia_line_to_table', line: i }); //调入人库存表

                    var dr_xql = this_record.getSublistValue({ sublistId: item_type, fieldId: 'custrecord_ywy_xql', line: i }); //记录的调入人需求量

                    if (isEmpty(tz_num)) {
                        message_str += '货品[' + hp_name + '] 调整数量不能为空 <br />';
                        is_status = -1;
                        break;
                    }
                    if (isEmpty(dc_user_id) || isEmpty(dc_kcb_id) || isEmpty(dr_user_id) || isEmpty(dr_kcb_id)) {
                        message_str += '货品[' + hp_name + '] 调出人,调入人,以及对应的库存表都不能为空 <br />';
                        is_status = -1;
                        break;
                    }

                    //更新调出人分配出
                    var dc_kcb_record = record.load({ type: 'customrecord_person_assignment_line', id: dc_kcb_id, isDynamic: true });
                    var custrecord_pal_plan_ava_count = dc_kcb_record.getValue({ fieldId: 'custrecord_pal_plan_ava_count' }); //业务员计划剩余可用量
                    if (custrecord_pal_plan_ava_count >= tz_num) { //可用量 大于 调整数量
                        var old_dbc_num = dc_kcb_record.getValue({ fieldId: 'custrecord_diaob_fp' });
                        //更新调入人分配入
                        var dr_kcb_record = record.load({ type: 'customrecord_person_assignment_line', id: dr_kcb_id, isDynamic: true });
                        var old_dbr_num = dr_kcb_record.getValue({ fieldId: 'custrecord556' });

                        update_arr.push({ 'hp_name': hp_name, 'dc_user_name': dc_user_name, 'tz_num': tz_num, 'old_dbc_num': old_dbc_num, 'old_dbr_num': old_dbr_num, 'dr_user_name': dr_user_name, 'dc_kcb_id': dc_kcb_id, 'dr_kcb_id': dr_kcb_id, 'hp_id': hp_id, 'dr_user_id': dr_user_id, 'dr_xql': dr_xql });

                        is_status = 1;
                    } else {
                        message_str += '货品[' + hp_name + '] 调出人[' + dc_user_name + '] 剩余可用量[' + custrecord_pal_plan_ava_count + ']不足调出数量[' + tz_num + '] <br />';
                        is_status = -2;
                        break;
                    }
                }

                if (is_status == 1) {
                    for (var i = 0; i < update_arr.length; i++) {
                        var dc_kcb_id = update_arr[i].dc_kcb_id;
                        var old_dbc_num = update_arr[i].old_dbc_num;
                        var tz_num = update_arr[i].tz_num;
                        var dr_kcb_id = update_arr[i].dr_kcb_id;
                        var old_dbr_num = update_arr[i].old_dbr_num;
                        var hp_name = update_arr[i].hp_name;
                        var dc_user_name = update_arr[i].dc_user_name;
                        var dr_user_name = update_arr[i].dr_user_name;
                        var hp_id = update_arr[i].hp_id;
                        var dr_user_id = update_arr[i].dr_user_id;
                        var custrecord_month_xql = update_arr[i].dr_xql;

                        if (custrecord_sia_type == 4) { //需要更新 需求申请需求行 需求批准量 custrecord_tfl_need_approve_amount
                            var today = new Date();
                            var firstDay = new Date(today.getFullYear(), today.getMonth(), 1); //当月一号 需抹掉 '00秒' ':00' '-00' ns系统首选项没有秒设置, 
                            var formattedDate = format.format({ value: firstDay, type: format.Type.DATETIME }); //格式化为用户首选项日期格式 系统模块format格式化会默认带上
                            var formatDate = formattedDate;

                            if (formattedDate.includes('00秒')) formatDate = formattedDate.replace(/00秒$/, '');
                            if (formattedDate.includes(':00:00')) formatDate = formattedDate.replace(/:00:00/, ':00');
                            if (formattedDate.includes('-00-00')) formatDate = formattedDate.replace(/-00-00/, '-00');

                            var filters = [
                                ['isinactive', 'IS', 'F']
                                , 'AND', ['custrecord_tfl_item', 'ANYOF', hp_id]
                                , 'AND', ['custrecord_tfl_to_employee', 'ANYOF', dr_user_id]
                                , 'AND', ['created', 'ONORAFTER', formatDate] //当月1号凌晨零点
                            ];

                            var search_data = search.create({ type: 'customrecord_transfer_from_line', filters: filters, columns: ['internalid'] });
                            var xqsqd_id = null; //需求申请需求行id
                            search_data.run().each(function (res) {
                                xqsqd_id = res.getValue('internalid');
                                return false; // 只取第一个匹配项 默认应该只有一个单据
                            });

                            if (!isEmpty(xqsqd_id)) {
                                record.submitFields({ type: 'customrecord_transfer_from_line', id: xqsqd_id, values: { 'custrecord_tfl_need_approve_amount': tz_num } });//更新需求批准量字段
                                message_str += '货品[' + hp_name + '] 固定分配, 调入人[' + dr_user_name + '] 调整需求批准量[' + tz_num + '] <br />';
                            } else {
                                message_str += '货品[' + hp_name + '] 固定分配, 未找到需求申请需求行. <br />';
                            }
                        }
                        record.submitFields({ type: 'customrecord_person_assignment_line', id: dc_kcb_id, values: { 'custrecord_diaob_fp': old_dbc_num + tz_num } });
                        record.submitFields({ type: 'customrecord_person_assignment_line', id: dr_kcb_id, values: { 'custrecord556': old_dbr_num + tz_num } });
                        record.submitFields({ type: 'customrecord_person_assignment_line', id: dr_kcb_id, values: { 'custrecord_month_xql': custrecord_month_xql } });

                        message_str += '货品[' + hp_name + '] 调出人[' + dc_user_name + '] 增加调拨出数量成功[' + tz_num + '] <br />';
                        message_str += '货品[' + hp_name + '] 调入人[' + dr_user_name + '] 增加调拨入数量成功[' + tz_num + '] <br />';
                    }

                    this_record.setValue({ fieldId: 'custrecord_sia_line_state', value: 10 }); //业务员库存调整单状态 2-已批准 10-已更新 9-已驳回

                    this_record.save();
                } else if (is_status == -2) {
                    this_record.setValue({ fieldId: 'custrecord_sia_line_state', value: 9 }); //业务员库存调整单状态 2-已批准 10-已更新 9-已驳回

                    this_record.save();
                }

                dialog.confirm({ title: '提示', message: message_str }).then(function (result) {
                    window.location.reload();
                });
            } catch (e) {
                log.debug('updateKcTz-失败', e);
                dialog.alert({ title: 'ERROR', message: '更新库存调整单失败，请联系管理员。' });
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

        //获取当月凌晨一点 并根据首选项格式化的
        function getMonthOneDay() {
            var today = new Date();
            var firstDay = new Date(today.getFullYear(), today.getMonth(), 1); //当月一号 需抹掉 '00秒' ':00' '-00' ns系统首选项没有秒设置, 
            var formattedDate = format.format({ value: firstDay, type: format.Type.DATETIME }); //格式化为用户首选项日期格式 系统模块format格式化会默认带上
            var formatDate = formattedDate;

            if (formattedDate.includes('00秒')) formatDate = formattedDate.replace(/00秒$/, '');
            if (formattedDate.includes(':00:00')) formatDate = formattedDate.replace(/:00:00/, ':00');
            if (formattedDate.includes('-00-00')) formatDate = formattedDate.replace(/-00-00/, '-00');

            return formatDate;
        }

        return EXPORT_OBJ;  // 导出函数对象
    });
