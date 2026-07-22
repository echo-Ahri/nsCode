/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/ui/message', 'N/currentRecord', 'N/log', 'N/ui/dialog'],
    function (runtime, message, currentRecord, log, dialog) {
        var EXPORT_OBJ = {
            pageInit: pageInit,
            fieldChanged: fieldChanged,  // 添加 fieldChanged 事件，用于全选复选框的变动处理
            backCheckFyData: backCheckFyData
        };

        var thisData = {}; //存储当前对象记录的数据

        // 页面初始化时检查是否有提交结果并显示消息
        function pageInit(context) {
            thisData = context.currentRecord;
            console.log('pageInit');
        }

        //回写费用行
        function backCheckFyData(context) {
            console.log('backCheckFyData');
            var line_count = thisData.getLineCount({ sublistId: 'custpage_check_fy_list' });
            var back_data = [];
            for (var i = 0; i < line_count; i++) { //遍历子列表
                var is_checked = thisData.getSublistValue({ sublistId: 'custpage_check_fy_list', fieldId: 'custpage_checkbox', line: i });
                if (is_checked) {
                    var custpage_id = thisData.getSublistValue({ sublistId: 'custpage_check_fy_list', fieldId: 'custpage_id', line: i });
                    var custpage_price = thisData.getSublistValue({ sublistId: 'custpage_check_fy_list', fieldId: 'custpage_price', line: i });
                    if (custpage_price > 0) {
                        var custpage_sum = thisData.getSublistValue({ sublistId: 'custpage_check_fy_list', fieldId: 'custpage_sum', line: i });
                        back_data.push({ 'custpage_id': custpage_id, 'custpage_sum': custpage_sum, 'custpage_price': custpage_price });
                    }
                }
            }
            if (back_data.length > 0) {
                window.parent.postMessage(back_data, '*');
                dialog.alert({ title: '提示', message: '已回写费用行至货品行, 请先点击[关闭]按钮, 关闭弹窗, 然后检查并完善数据!', });
            } else {
                dialog.alert({ title: '提示', message: '请勾选费用行, 并填写价格', });
            }
        }

        // 更新 URL 中的参数
        function changeURLArg(curUrl, arg, arg_val) {
            var pattern = arg + '=([^&]*)';
            var replaceText = arg + '=' + arg_val;
            if (curUrl.match(pattern)) { //如果参数已存在，则替换
                return curUrl.replace(new RegExp(pattern), replaceText);
            } else {
                if (curUrl.match('[?]')) { //如果参数不存在，则添加
                    return curUrl + '&' + replaceText;
                } else {
                    return curUrl + '?' + replaceText;
                }
            }
        }

        function fieldChanged(context) {
            var fieldId = context.fieldId;
            if (context.fieldId === 'select_checkbox_all') { //检查是否修改的是 "全选" 复选框
                var isChecked = context.currentRecord.getValue('select_checkbox_all');
                var lineCount = context.currentRecord.getLineCount({ sublistId: 'custpage_check_fy_list' });

                for (var i = 0; i < lineCount; i++) { //遍历子列表并设置复选框值
                    context.currentRecord.selectLine({ sublistId: 'custpage_check_fy_list', line: i });
                    context.currentRecord.setCurrentSublistValue({ sublistId: 'custpage_check_fy_list', fieldId: 'custpage_checkbox', value: isChecked });
                    context.currentRecord.commitLine({ sublistId: 'custpage_check_fy_list' }); //子列表
                }
            }
            if (fieldId == 'fy_item_name') { //费用筛选
                var fy_item_name = context.currentRecord.getValue('fy_item_name');
                if (fy_item_name) {
                    var url = window.location.href;
                    url = changeURLArg(url, 'fy_item_name', fy_item_name);
                    setWindowChanged(window, false); // + "&seltype=" + selType
                    window.location.href = url;
                } else {
                    var url = window.location.href;
                    url = url.split("&fy_item_name")[0];
                    setWindowChanged(window, false); // + "&seltype=" + selType
                    window.location.href = url;
                }
            }
        }

        return EXPORT_OBJ;  // 导出函数对象
    });
