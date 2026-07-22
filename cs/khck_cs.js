/*
 * @Descripttion: 
 * @Author: dsp
 */
/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/ui/message', 'N/record', 'N/log', 'N/ui/dialog', 'N/url'],
    function (runtime, message, record, log, dialog, url) {
        var EXPORT_OBJ = {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            saveRecord: saveRecord,
        };

        var thisData = {}; //存储当前对象记录的数据

        // 页面初始化时检查是否有提交结果并显示消息
        function pageInit(context) {
            thisData = context.currentRecord;
            console.log('pageInit');

            var urls = window.location.href;
            var params = getUrlParams(urls);
            if (!isEmpty(params['gjd_id'])) { //估价单跳转
                var gjdData = record.load({ type: 'estimate', id: params['gjd_id'] }); //估价单记录类型

                var subsidiary = gjdData.getValue({ fieldId: 'subsidiary' }); //子公司
                var entity = gjdData.getValue({ fieldId: 'entity' }); //客户
                var custbody_main_currency = gjdData.getValue({ fieldId: 'custbody_main_currency' }); //币种

                thisData.setValue({ fieldId: 'subsidiary', value: subsidiary }); //子公司
                thisData.setValue({ fieldId: 'customer', value: entity }); //客户
                thisData.setValue({ fieldId: 'custbody_create_gjd_id', value: params['gjd_id'], ignoreFieldChange: true }); //关联估价单ID
                
                var hp_item_id = 'item'; //估价单 货品明细行
                // var hpItemCount = gjdData.getLineCount({ sublistId: hp_item_id }); // 获取子列表的行数
                
                var price_sum = 0; //计算总金额
                // for (var i = 0; i < hpItemCount; i++) {
                //     /* var hp_type = gjdData.getSublistValue({ sublistId: hp_item_id, fieldId: 'custcol_major_category', line: i });
                //     if (hp_type != 30) { //产品大类，费用货品=30
                //     continue;
                //     } */
                //    var price = gjdData.getSublistValue({ sublistId: hp_item_id, fieldId: 'amount', line: i });
                //    price_sum += price; //累加金额
                // }
                price_sum = gjdData.getValue({ fieldId: 'custbody_gjd_yfk_price' }); //预付款金额

                if(isEmpty(price_sum)){
                    dialog.alert({ title: '提示', message: '基础数据已填充, 但未找到预付款金额信息, 请先在估价单填写预付款金额, 再创建客户存款!' });
                }else{
                    thisData.setValue({ fieldId: 'currency', value: custbody_main_currency }); //币种
    
                    thisData.setValue({ fieldId: 'payment', value: price_sum }); //付款金额
    
                    dialog.alert({ title: '提示', message: '基础数据已填充, 请修正 [付款金额] [货币] 信息' });
                }
            }
        }

        function fieldChanged(context) {
            console.log('fieldChanged');
            var change_field = context.fieldId; //当前改变的字段
        }

        // 保存记录时的验证逻辑
        function saveRecord(context) {
            console.log('saveRecord');
            var gjd_id = thisData.getValue({ fieldId: 'custbody_create_gjd_id' });
            if (!isEmpty(gjd_id)) { //估价单跳转
                var gjdData = record.load({ type: 'estimate', id: gjd_id }); //估价单记录类型

                gjdData.setValue({ fieldId: 'custbody_adv_payment_status', value: 1 }); //创建 预付款申请单 估价单资金状态 -> 待提交1

                gjdData.save();
            }
            return true;
        }

        function getUrlParams(urls) {
            var params = [];
            var urlArr = urls.split('?');
            if (urlArr && urlArr.length > 1) {
                var paramsArr = urlArr[1].split('&');
                for (var i = 0; i < paramsArr.length; i++) {
                    var param = paramsArr[i].split('=');
                    params[param[0]] = param[1];
                }
            }
            return params;
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
