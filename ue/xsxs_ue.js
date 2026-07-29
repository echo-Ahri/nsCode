/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/file', 'N/log', 'N/runtime', 'N/url', 'N/record', 'N/search', 'N/config', 'N/ui/serverWidget'], (file, log, runtime, url, record, search, config, serverWidget) => {
    const beforeLoad = (context) => {
        var pageMode = context.type; //获取当前页面模式
        var currentUser = runtime.getCurrentUser(); //获取登录用户的角色

        var form = context.form;
        // form.removeButton('convertlead'); //删除转换按钮

        var rec = context.newRecord; //当前打开的记录
        var rec_id = rec.id; //当前记录的id
        var rec_type = rec.type; //记录的类型

        //加载客户端脚本文件（已定义按钮需要调用的函数）
        var fileObj = file.load({
            id: 'SuiteScripts/dsp_scripts/cs/xsxs_cs.js',
        });
        form.clientScriptFileId = fileObj.id;
        
        var type = rec.getValue('isperson');
        // log.debug('type', {'type':type });

        if (!isEmpty(rec_id) && type) {  //是 个人 类型才能转换
            form.addButton({
                id: 'custpage_xszh_btn',
                label: '[销售线索转换潜在客户]',
                functionName: 'xsZhKh(' + rec_id + ',"' + rec_type + '")',
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
