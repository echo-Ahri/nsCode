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
            saveRecord: saveRecord
        };

        var thisData = {}; //存储当前对象记录的数据

        // 页面初始化时检查是否有提交结果并显示消息
        function pageInit(context) {
            console.log('pageInit');
            thisData = context.currentRecord; //这里是销售需求申请单数据
        }

        function fieldChanged(context) {
            // console.log('fieldChanged');
            var change_field = context.fieldId; //当前改变的字段

        }

        // 保存记录时的验证逻辑
        function saveRecord(context) {
            console.log('saveRecord');
            try {
                var sq_type = thisData.getValue({ fieldId: 'custrecord88' }); //申请类型 8 每月固定需求申请
                if (sq_type == 8) { //需要校验每月 每个用户 每种货品只有一个固定需求申请
                    var item_id = 'recmachcustrecord_tfl_main';
                    var item_count = thisData.getLineCount({ sublistId: item_id }); // 获取子列表的行数

                    var today = new Date();
                    var firstDay = new Date(today.getFullYear(), today.getMonth(), 1); //当月一号 需抹掉 '00秒' ':00' '-00' ns系统首选项没有秒设置, 
                    var formattedDate = format.format({ value: firstDay, type: format.Type.DATETIME }); //格式化为用户首选项日期格式 系统模块format格式化会默认带上
                    var formatDate = formattedDate;

                    if (formattedDate.includes('00秒')) formatDate = formattedDate.replace(/00秒$/, '');
                    if (formattedDate.includes(':00:00')) formatDate = formattedDate.replace(/:00:00/, ':00');
                    if (formattedDate.includes('-00-00')) formatDate = formattedDate.replace(/-00-00/, '-00');

                    var is_have = false;
                    var is_have_message = '';
                    var unique_arr = [];
                    for (var i = 0; i < item_count; i++) {
                        var hp_id = thisData.getSublistValue({ sublistId: item_id, fieldId: 'custrecord_tfl_item', line: i });
                        var hp_name = thisData.getSublistValue({ sublistId: item_id, fieldId: 'custrecord_hpmc', line: i });
                        var xqr_id = thisData.getSublistValue({ sublistId: item_id, fieldId: 'custrecord_tfl_to_employee', line: i });
                        var xqr_name = thisData.getSublistValue({ sublistId: item_id, fieldId: 'custrecord_tfl_to_employee_display', line: i });
                        // var sqh_id = thisData.getSublistValue({ sublistId: item_id, fieldId: 'custrecord_tfl_unique_number', line: i });
                        var sqh_id = thisData.getSublistValue({ sublistId: item_id, fieldId: 'id', line: i });

                        if (!unique_arr.includes(hp_id + '_' + xqr_id)) {
                            unique_arr.push(hp_id + '_' + xqr_id);
                        } else {
                            is_have_message = '货品[' + hp_name + '] 需求人[' + xqr_name + ']已经有相同需求申请行了, 请合并数量, 删除重复行提交';
                            is_have = true;
                            break;
                        }

                        var filters = [
                            ['isinactive', 'IS', 'F']
                            // , 'AND', ['custrecord_tfl_unique_number', 'ISNOT', sqh_id] //排除自己的情况 权限不支持
                            // , 'AND', ['id', 'ISNOT', sqh_id] //排除自己的情况 查询失败 明明也是一样id 但是能搜索出来 改为在后面判断
                            , 'AND', ['custrecord_tfl_item', 'ANYOF', hp_id]
                            , 'AND', ['custrecord_tfl_to_employee', 'ANYOF', xqr_id]
                            , 'AND', ['created', 'ONORAFTER', formatDate] //当月1号凌晨零点
                        ];
                        console.log('filters', filters);
                        var search_data = search.create({ type: 'customrecord_transfer_from_line', filters: filters, columns: ['internalid', 'custrecord_tfl_main'] });
                        search_data.run().each(function (res) {
                            var xqsqd_h_id = res.getValue('internalid'); //查询到的子行id 需求申请需求行id
                            var xqsqd_id = res.getValue('custrecord_tfl_main'); //主行id
                            if (!isEmpty(xqsqd_h_id) && sqh_id != xqsqd_h_id) { //能查到当前月 是相同货品 相同需求人的 就再查一下是不是固定申请类型
                                var xqsqd_info = record.load({ type: 'customrecord_need_transfer', id: xqsqd_id });
                                var sq_type = xqsqd_info.getValue({ fieldId: 'custrecord88' });
                                if (sq_type == 8) { //也是固定申请类型
                                    is_have_message = '货品[' + hp_name + '] 需求人[' + xqr_name + ']在本月已经存在固定需求申报[' + xqsqd_id + ']了, 请填写临时需求申报';
                                    return false; //不循环了
                                }
                            }
                            return true; //继续查下一条记录
                        });
                        if (is_have_message) {
                            is_have = true;
                            break;
                        }
                    }
                    if (is_have) {
                        dialog.alert({ title: '提示', message: is_have_message });
                        return false;
                    }
                }
                return true; //默认不阻止表单提交
            } catch (e) {
                log.debug('saveRecord', e);
                dialog.alert({ title: '提示', message: '单据保存失败，请联系管理员。', });
                return false;
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
