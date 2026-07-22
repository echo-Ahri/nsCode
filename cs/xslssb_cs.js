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
            if (!isEmpty(params['sj_id'])) { //商机跳转
                var sjData = record.load({
                    type: 'opportunity', //商机记录类型
                    id: params['sj_id']
                });

                var subsidiary = sjData.getValue({ fieldId: 'subsidiary' }); //子公司
                var salesrep = sjData.getValue({ fieldId: 'salesrep' }); //销售代表
                thisData.setValue({
                    fieldId: 'custrecord_create_sj', //创建自商机
                    value: params['sj_id'],
                    ignoreFieldChange: true,
                });
                thisData.setValue({
                    fieldId: 'custrecord555', //子公司
                    value: subsidiary,
                    ignoreFieldChange: true,
                });
                thisData.setValue({
                    fieldId: 'custrecord88', //类型
                    value: 9, //每月临时需求申请
                    ignoreFieldChange: true,
                });

                var hp_item_id = 'item'; //商机货品明细行
                var item_id = 'recmachcustrecord_tfl_main'; //需求申请单货品明细行
                var hpItemCount = sjData.getLineCount({ sublistId: hp_item_id }); // 获取子列表的行数
                var hpFieldMap = { //商机 需求单货品字段映射
                    item: 'custrecord_tfl_item', //货品
                    units: 'custrecord_tfl_unit', //单位
                    // units: 'custrecord_tfl_item_delivery', //交付地
                    // units: 'custrecord_tfl_item_currency', //币种
                    custcol18: 'custrecord_tfl_to_table', //业务员库存表 - 需求人库存表
                    // quantity: 'custrecord_tfl_need_amount', //数量 - 需求数量
                    rate: 'custrecord_need_unit_price', //价格 - 货品单价
                    // units: 'custrecord_need_demand_fund', //需求资金
                    // displayname: 'custrecord_hpmc', //货品名称
                    // custitem_packing_type: 'custrecord_tfl_paking', //包装分类
                }
                var sjItemType = 'item';
                var ywy_kc_map = new Map(); //业务员库存数量 ID做键 数量做值
                for (var i = 0; i < hpItemCount; i++) {
                    var hp_type = sjData.getSublistValue({
                        sublistId: sjItemType,
                        fieldId: 'custcol_major_category',
                        line: i
                    });
                    if (hp_type != 28) {//产品大类，库存货品=28
                        continue;
                    }

                    //当前货品数量
                    var xq_hp_sl = sjData.getSublistValue({
                        sublistId: sjItemType,
                        fieldId: 'quantity',
                        line: i
                    });
                    //当前货品关联业务员库存分配表id 货品-业务员 唯一
                    var ywy_kc_id = sjData.getSublistValue({
                        sublistId: sjItemType,
                        fieldId: 'custcol18', //业务员库存分配表
                        line: i
                    });

                    var ymy_kc_key = 'ywy_' + ywy_kc_id; //拼接 业务员库存表ID键
                    var ymy_kc_val = 0;
                    if (ywy_kc_map.has(ymy_kc_key)) {
                        ymy_kc_val = ywy_kc_map.get(ymy_kc_key); //获取剩余数量
                    } else { //没有记录业务员库存表数量
                        //业务员库存分配行
                        var ywy_kc_data = record.load({
                            type: 'customrecord_person_assignment_line',
                            id: ywy_kc_id,
                        });
                        var ywy_ky_kc = ywy_kc_data.getValue({
                            fieldId: 'custrecord_pal_plan_ava_count', //业务员计划剩余可用量
                        });
                        var jy_kc_ky = ywy_ky_kc; //校验库存可用 可用-占用=剩余可用(可用已配置公司扣减 直接取)

                        ywy_kc_map.set(ymy_kc_key, jy_kc_ky);
                        ymy_kc_val = jy_kc_ky;
                    }

                    if (xq_hp_sl > ymy_kc_val) { //缺货的货品
                        thisData.selectNewLine({ sublistId: item_id }); //添加新行
                        
                        for (var sj_item_field in hpFieldMap) {
                            var xqd_hp_field = hpFieldMap[sj_item_field]; //需求单货品行字段
                            var hp_value = sjData.getSublistValue({
                                sublistId: hp_item_id,
                                fieldId: sj_item_field,
                                line: i
                            });
                            
                            // 将值设置到目标记录的子列表字段
                            thisData.setCurrentSublistValue({
                                sublistId: item_id,
                                fieldId: xqd_hp_field,
                                value: hp_value,
                                ignoreFieldChange: true
                            });
                        }
                        thisData.setCurrentSublistValue({
                            sublistId: item_id,
                            fieldId: 'custrecord_tfl_to_employee',
                            // value: runtime.getCurrentUser().id, //取商机的销售代表
                            value: salesrep, //取商机的销售代表
                            ignoreFieldChange: true
                        });
                        
                        //取出货品信息设置
                        var hp_id = sjData.getSublistValue({
                            sublistId: hp_item_id,
                            fieldId: 'item',
                            line: i
                        });
                        var hp_info = record.load({
                            type: 'lotnumberedinventoryitem', //货品记录类型
                            id: hp_id
                        });
                        var displayname = hp_info.getValue({ fieldId: 'displayname' });
                        var custitem_packing_type = hp_info.getValue({ fieldId: 'custitem_packing_type' });
                        thisData.setCurrentSublistValue({
                            sublistId: item_id,
                            fieldId: 'custrecord_hpmc', //货品名称
                            value: displayname,
                            ignoreFieldChange: true
                        });
                        thisData.setCurrentSublistValue({
                            sublistId: item_id,
                            fieldId: 'custrecord_tfl_paking', //包装分类
                            value: custitem_packing_type,
                            ignoreFieldChange: true
                        });
                        var hp_qh_sl = xq_hp_sl - ymy_kc_val; //货品缺货数量
                        thisData.setCurrentSublistValue({
                            sublistId: item_id,
                            fieldId: 'custrecord_tfl_need_amount', //需求数量
                            value: hp_qh_sl,
                            ignoreFieldChange: true
                        });

                        // 提交子列表行
                        thisData.commitLine({ sublistId: item_id });
                    }
                }
            }
        }

        function fieldChanged(context) {
            console.log('fieldChanged');
            var change_field = context.fieldId; //当前改变的字段
        }

        // 保存记录时的验证逻辑
        function saveRecord(context) {

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
