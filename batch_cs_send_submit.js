/*
 * @Descripttion: 
 * @Author: guodingdong
 * @version: 
 * @Date: 2024-12-03 09:48:25
 * @LastEditors: gdd
 * @LastEditTime: 2024-12-05 08:54:00
 */
/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/ui/message', 'N/currentRecord', 'N/log'],
    function (runtime, message, currentRecord, log) {
        var EXPORT_OBJ = {
            // saveRecord: saveRecord,
            // pageChanged: pageChanged,
            // pageInit: pageInit,  // 添加 pageInit 事件
            fieldChanged: fieldChanged  // 添加 fieldChanged 事件，用于全选复选框的变动处理
            // send:send,

        };
        // 页面初始化时检查是否有提交结果并显示消息
        function pageInit(context) {
           
        }

        // 保存记录时的验证逻辑
        function saveRecord(scriptContext) {
            
        }

        // 当页面发生变化时处理分页
        function pageChanged(page) {
            var thisUrl = window.location.href;
            thisUrl = changeURLArg(thisUrl, 'curPageIndex', page);  // 更新分页参数
            setWindowChanged(window, false);
            window.location.href = thisUrl;  // 重新加载页面
        }

        // 更新 URL 中的参数
        function changeURLArg(curUrl, arg, arg_val) {
            var pattern = arg + '=([^&]*)';
            var replaceText = arg + '=' + arg_val;

            // 如果参数已存在，则替换
            if (curUrl.match(pattern)) {
                return curUrl.replace(new RegExp(pattern), replaceText);
            } else {
                // 如果参数不存在，则添加
                if (curUrl.match('[?]')) {
                    return curUrl + '&' + replaceText;
                } else {
                    return curUrl + '?' + replaceText;
                }
            }
        }

        return EXPORT_OBJ;  // 导出函数对象

        function fieldChanged(context) {
            var fieldId = context.fieldId;
            // 检查是否修改的是 "全选" 复选框
            if (context.fieldId === 'select_checkbox_all') {
                // log.debug("进入全选代码：");
                var isChecked = context.currentRecord.getValue('select_checkbox_all');
                var lineCount = context.currentRecord.getLineCount({ sublistId: 'custpage_pr_list' });

                // 遍历子列表并设置复选框值
                for (var i = 0; i < lineCount; i++) {
                    context.currentRecord.selectLine({ sublistId: 'custpage_pr_list', line: i });
                    context.currentRecord.setCurrentSublistValue({
                        sublistId: 'custpage_pr_list',
                        fieldId: 'custpage_checkbox',
                        value: isChecked
                    });
                    context.currentRecord.commitLine({ sublistId: 'custpage_pr_list' }); //子列表
                }
            }
            if (fieldId == 'business_phase') { //处理阶段
                var business_phase = context.currentRecord.getValue('business_phase');
                if (business_phase) {
                    var url = window.location.href;
                    url = changeURLArg(url, 'business_phase', business_phase);
                    setWindowChanged(window, false); // + "&seltype=" + selType
                    window.location.href = url;
                } else {
                    var url = window.location.href;
                    url = url.split("&business_phase")[0];
                    setWindowChanged(window, false); // + "&seltype=" + selType
                    window.location.href = url;
                }
            }
            if (fieldId == 'document_type') { //贸易类型
                var document_type = context.currentRecord.getValue('document_type');
                if (document_type) {
                    var url = window.location.href;
                    url = changeURLArg(url, 'document_type', document_type);
                    setWindowChanged(window, false); // + "&seltype=" + selType
                    window.location.href = url;
                } else {
                    var url = window.location.href;
                    url = url.split("&document_type")[0];
                    setWindowChanged(window, false); // + "&seltype=" + selType
                    window.location.href = url;
                }
            }
        }



        return {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            // send:send
        };
    });
