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
            fieldChanged: fieldChanged
        };

        var thisData = {}; //存储当前对象记录的数据

        // 页面初始化时检查是否有提交结果并显示消息
        function pageInit(context) {
            thisData = context.currentRecord;
            console.log('pageInit');

            var urls = window.location.href;
            var params = getUrlParams(urls);
            if (!isEmpty(params['xsfysqd_id']) && !isEmpty(params['gys_id'])) { //销售费用申请单跳转
                var xsfysqdData = record.load({ type: 'customrecord_sales_cost_sqd', id: params['xsfysqd_id'] }); //销售费用申请单记录类型
                // thisData.setValue({ fieldId: 'customform', value: 222, ignoreFieldChange: true }); //自定义表单 费用登记（订单数据处理）
                // thisData.setValue({ fieldId: 'entity', value: params['gys_id'] }); //供应商 , ignoreFieldChange: true

                var custrecord_fysqd_bz = xsfysqdData.getValue({ fieldId: 'custrecord_fysqd_bz' }); //币种
                var custrecord_fysqd_gs = xsfysqdData.getValue({ fieldId: 'custrecord_fysqd_gs' }); //子公司
                var custrecord_fysqd_xsy = xsfysqdData.getValue({ fieldId: 'custrecord_fysqd_xsy' }); //销售代表
                var custrecord_fysqd_so_id = xsfysqdData.getValue({ fieldId: 'custrecord_fysqd_so_id' }); //销售订单

                thisData.setValue({ fieldId: 'currency', value: custrecord_fysqd_bz }); //币种
                // thisData.setValue({ fieldId: 'subsidiary', value: custrecord_fysqd_gs }); //子公司 , fireSyncSlaving: true  设置会被刷掉
                thisData.setValue({ fieldId: 'custbody_salesman', value: custrecord_fysqd_xsy, ignoreFieldChange: true }); //销售代表
                thisData.setValue({ fieldId: 'custbody_xsdd_id', value: custrecord_fysqd_so_id, ignoreFieldChange: true }); //销售订单关联
                thisData.setValue({ fieldId: 'custbody_xsfysqd_id', value: params['xsfysqd_id'], ignoreFieldChange: true }); //销售费用申请单关联
                thisData.setValue({ fieldId: 'custbody_xsfysqd_zgs', value: custrecord_fysqd_gs, ignoreFieldChange: true }); //销售费用申请单子公司

                var hp_item_id = 'recmachcustrecord_fysqd_id'; //销售费用申请单 货品明细行
                var item_id = 'expense'; //输入账单 费用明细行
                var hpItemCount = xsfysqdData.getLineCount({ sublistId: hp_item_id }); // 获取子列表的行数
                /* var hpFieldMap = { //销售费用申请单 输入账单货品字段映射
                    custrecord_fysqd_i_fy_type: 'account', //类别
                    custrecord_fysqd_i_fy_type_display: 'account', //类别
                    // custrecord_fysqd_i_num: 'quantity', //数量
                    custrecord_fysqd_i_price: 'amount', //价格 - 货品单价
                    custrecord_fysqd_i_sm: 'taxcode', //税码 - 税码
                    // custrecord_fysqd_i_kc: 'location', //库存地点 - 仓库
                }; */
                var fymx_str = '', j = 1;
                for (var i = 0; i < hpItemCount; i++) {
                    var gys_id = xsfysqdData.getSublistValue({ sublistId: hp_item_id, fieldId: 'custrecord_xsfysqd_i_gys', line: i });
                    if (params['gys_id'] == gys_id) {
                        /* thisData.selectNewLine({ sublistId: item_id }); //添加新行
                        for (var xsfysqd_item_field in hpFieldMap) {
                            var srzd_hp_field = hpFieldMap[xsfysqd_item_field]; //需求单货品行字段
                            var hp_value = xsfysqdData.getSublistValue({ sublistId: hp_item_id, fieldId: xsfysqd_item_field, line: i });
                            console.log(xsfysqd_item_field, hp_value);
                
                            thisData.setCurrentSublistValue({ sublistId: item_id, fieldId: srzd_hp_field, value: hp_value, ignoreFieldChange: true }); // 将值设置到目标记录的子列表字段
                        }
                        thisData.commitLine({ sublistId: item_id }); //提交子列表行 */
                        var account = xsfysqdData.getSublistValue({ sublistId: hp_item_id, fieldId: 'custrecord_fysqd_i_fy_type_display', line: i });
                        var amount = xsfysqdData.getSublistValue({ sublistId: hp_item_id, fieldId: 'custrecord_fysqd_i_price', line: i });
                        var taxcode_id = xsfysqdData.getSublistValue({ sublistId: hp_item_id, fieldId: 'custrecord_fysqd_i_sm', line: i });
                        if(isEmpty(taxcode_id)){
                            var taxcode = '销售费用申请单子行未选择税码';
                        }else{
                            var taxcode = record.load({ type: 'salestaxitem', id: taxcode_id }).getValue({ fieldId: 'itemid' });
                        }

                        fymx_str += '[' + j + '] -->   [类别]: ' + account + '   [价格]: ' + amount + '   [税码]: ' + taxcode + '    \n';
                        j++;
                    }
                }
                thisData.setValue({ fieldId: 'custbody_xsfysqd_fymx', value: fymx_str, ignoreFieldChange: true }); //销售费用申请单子公司
            }
        }

        function fieldChanged(context) {
            var change_field = context.fieldId; //当前改变的字段
            console.log('fieldChanged', change_field);
        }

        function getUrlParams(urls) {
          var params = [];
          var urlArr = urls.split('?');
          //console.log('urlArr', urlArr);
          if(urlArr && urlArr.length > 1) {
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
