/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/file', 'N/log', 'N/runtime', 'N/url', 'N/record', 'N/search'], (file, log, runtime, url, record, search) => {
    const beforeLoad = (context) => {
        //获取当前页面模式
        var pageMode = context.type;
        //获取登录用户的角色
        var currentUser = runtime.getCurrentUser();

        var form = context.form;

        var rec = context.newRecord; //当前打开的记录
        var rec_id = rec.id; //当前记录的id
        var rec_type = rec.type; //记录的类型

        //加载客户端脚本文件（已定义按钮需要调用的函数）
        var fileObj = file.load({
            id: 'SuiteScripts/dsp_scripts/cs/xsdd_cs.js',
        });
        form.clientScriptFileId = fileObj.id;

        if(!isEmpty(rec_id)){
            var filters = [ //取出销售订单已经创建的销售发货
                ['createdfrom', 'ANYOF', rec_id] //此销售订单创建
                // , 'AND', ['shipstatus', 'ANYOF', 'C'] //状态已发运
                // , 'AND', ['status', 'IS', '已发运'] //状态已发运
            ];
            var search_data = search.create({ type: 'itemfulfillment', filters: filters, columns: ['internalid'] }); //销售发运
            var is_jump = false;
            search_data.run().each(function (res) {
                var xsfh_id = res.getValue('internalid');
                var data = record.load({ type: 'itemfulfillment', id: xsfh_id }); //销售发运 记录类型
    
                var shipstatus = data.getValue({ fieldId: 'shipstatus' });
                if(shipstatus == 'C'){
                    is_jump = true;
                    return false;
                }
                return true;
            });
    
            //添加跳转销售费用申请单按钮
            if (is_jump) { //能找到销售发货 已发运id
                form.addButton({
                    id: 'custpage_jump_xs_fysqd_btn',
                    label: '[销售费用申请单]',
                    functionName: 'jumpFySqd(' + rec_id + ',"' + rec_type + '")',
                });
            }
        }
    };

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
