/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/file', 'N/log', 'N/runtime', 'N/url', 'N/record', 'N/search', 'N/config', 'N/ui/serverWidget'], (file, log, runtime, url, record, search, config, serverWidget) => {
    const beforeLoad = (context) => {
        var pageMode = context.type; //获取当前页面模式
        var currentUser = runtime.getCurrentUser(); //获取登录用户的角色

        var form = context.form;

        var rec = context.newRecord; //当前打开的记录
        var rec_id = rec.id; //当前记录的id
        var rec_type = rec.type; //记录的类型

        //加载客户端脚本文件（已定义按钮需要调用的函数）
        var fileObj = file.load({
            id: 'SuiteScripts/dsp_scripts/cs/xsxs_qzkh_kh_cs.js',
        });
        form.clientScriptFileId = fileObj.id;
        
        var approveStatus = parseInt(rec.getValue('custentity33')); //审批状态
        var sqth_arr = [2, 3, 6, 7, 9, 10]; //销售线索已提交待审核 销售线索审核通过 潜在客户已提交待审核 潜在客户审核通过 客户已提交待审核 客户审核通过
        // log.debug('approveStatus', {'approveStatus':approveStatus, '1': sqth_arr.includes(approveStatus) });
        if (!isEmpty(rec_id) && sqth_arr.includes(approveStatus)) {
            form.addButton({
                id: 'custpage_sqth_btn',
                label: '[申请退回]',
                functionName: 'sqThEdit(' + rec_id + ',"' + rec_type + '")',
            });
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
