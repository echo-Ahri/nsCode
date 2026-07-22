/*
 * @Descripttion: 
 * @Author: dsp
 */
/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/ui/message', 'N/record', 'N/log', 'N/ui/dialog', 'N/search'],
    function (runtime, message, record, log, dialog, search) {
        var EXPORT_OBJ = {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            backWrite: backWrite //回写询价单
        };

        var thisData = {}, changeField = {}; //存储当前对象记录的数据

        // 页面初始化时检查是否有提交结果并显示消息
        function pageInit(context) {
            thisData = context.currentRecord;
            console.log('pageInit');
        }

        function fieldChanged(context) {
            console.log('fieldChanged');
        }

        // 保存记录时的验证逻辑
        function saveRecord(context) {

        }

        // 回写询价单
        function backWrite(recId, recType) {
            console.log('backWrite');
            var hp_item_id = 'recmachcustrecord_mul_xjd_id';
            try {
                //拿当前询价单审批状态, 通过才让回写
                var this_xjd_record = thisData;
                if (isEmpty(this_xjd_record)) this_xjd_record = record.load({ type: recType, id: recId }); //'customrecord_mul_xjd', // 询价单记录类型

                var sp_status = this_xjd_record.getValue({ fieldId: 'custrecord_xjd_sp_status' });  //审批状态
                if (sp_status != 18) { //不等于审批通过
                    dialog.alert({ title: '提示', message: '当前询价单还未审批通过, 请审批通过后再回写询价结果' });
                    return;
                }

                //拿行数
                var item_count = this_xjd_record.getLineCount({ sublistId: hp_item_id }); // 获取子列表的行数 货品明细行

                //判断是否价格填写完成
                var is_back = true;
                var hx_arr = []; //回写的货品信息
                for (var i = 0; i < item_count; i++) {
                    var custrecord_update_info = this_xjd_record.getSublistValue({ sublistId: hp_item_id, fieldId: 'custrecord_update_info', line: i }); //更新信息
                    if (!isEmpty(custrecord_update_info)) continue; //说明是之前生成的货品行 跳过

                    var this_xj_h_price = this_xjd_record.getSublistValue({ sublistId: hp_item_id, fieldId: 'custrecord_xj_h_price', line: i }); //货品询价后价格
                    this_xj_h_price = parseFloat(this_xj_h_price);

                    if (isEmpty(this_xj_h_price) || this_xj_h_price === 0) {
                        is_back = false;
                        break;
                    }
                    var xjd_item_id = this_xjd_record.getSublistValue({ sublistId: hp_item_id, fieldId: 'id', line: i }); //询价单明细行id
                    var dj_item_id = this_xjd_record.getSublistValue({ sublistId: hp_item_id, fieldId: 'custrecord_cj_hp_id', line: i }); //待回写单据明细行id
                    var xj_h_price = this_xjd_record.getSublistValue({ sublistId: hp_item_id, fieldId: 'custrecord_xj_h_price', line: i }); //询价后价格
                    var hp_type = this_xjd_record.getSublistValue({ sublistId: hp_item_id, fieldId: 'custrecord_cpdl', line: i }); //产品大类
                    var hp_id = this_xjd_record.getSublistValue({ sublistId: hp_item_id, fieldId: 'custrecord_hp_info', line: i }); //货品id
                    var obj = { 'xjd_item_id': xjd_item_id, 'dj_item_id': dj_item_id, 'xj_h_price': xj_h_price, 'hp_type': hp_type, 'hp_id': hp_id };
                    if (hp_type == 28) { //是货品类型
                        var custrecord_cpcb_jfcbj = this_xjd_record.getSublistValue({ sublistId: hp_item_id, fieldId: 'custrecord_xjd_jfcbj', line: i }); //供应链交付成本价
                        var custrecord_cpcb_nbcbj = this_xjd_record.getSublistValue({ sublistId: hp_item_id, fieldId: 'custrecord_xjd_nbcbj', line: i }); //供应链内部成本价
                        var custrecord_cpcb_cgjj = this_xjd_record.getSublistValue({ sublistId: hp_item_id, fieldId: 'custrecord_xjd_cgjj', line: i }); //供应链采购加价
                        var custrecord_cpcb_hdsy = this_xjd_record.getSublistValue({ sublistId: hp_item_id, fieldId: 'custrecord_xjd_hdsy', line: i }); //汇兑损益
                        var custrecord_cpcb_jlcbtz = this_xjd_record.getSublistValue({ sublistId: hp_item_id, fieldId: 'custrecord_xjd_jlcbtz', line: i }); //激励性成本调整
                        var custrecord_cpcb_nbjsj = this_xjd_record.getSublistValue({ sublistId: hp_item_id, fieldId: 'custrecord_xjd_nbjsj', line: i }); //销售内部结算价
                        var custrecord_cpcb_xsmlr = this_xjd_record.getSublistValue({ sublistId: hp_item_id, fieldId: 'custrecord_xjd_mll', line: i }); //销售毛利润
                        obj['custrecord_cpcb_jfcbj'] = custrecord_cpcb_jfcbj;
                        obj['custrecord_cpcb_nbcbj'] = custrecord_cpcb_nbcbj;
                        obj['custrecord_cpcb_cgjj'] = custrecord_cpcb_cgjj;
                        obj['custrecord_cpcb_hdsy'] = custrecord_cpcb_hdsy;
                        obj['custrecord_cpcb_jlcbtz'] = custrecord_cpcb_jlcbtz;
                        obj['custrecord_cpcb_nbjsj'] = custrecord_cpcb_nbjsj;
                        obj['custrecord_cpcb_xsmlr'] = custrecord_cpcb_xsmlr;
                    }
                    hx_arr.push(obj);
                }
                if (!is_back) {
                    dialog.alert({ title: '提示', message: '还存在子行记录未更新价格, 请先更新后再点击回写' });
                    return;
                }

                if (isEmpty(hx_arr)) {
                    dialog.alert({ title: '提示', message: '找不到需要回写的行, 请检查是否价格已填写或是作废的询价明细行' });
                    return;
                }

                var dj_id = this_xjd_record.getValue({ fieldId: 'custrecord_xjd_ref_id' }); //询价单对应的单据id
                var dj_type = this_xjd_record.getValue({ fieldId: 'custrecord_xjd_ref_type' }); //询价单对应的单据记录类型
                // log.debug("dj_id", {'dj_id':dj_id, 'dj_type':dj_type, 'hx_arr':hx_arr});
                if (hx_arr.length > 0 && !isEmpty(dj_id) && !isEmpty(dj_type)) {
                    var dj_record = record.load({ type: dj_type, id: dj_id }); // isDynamic: true  货品行记录类型

                    if (hx_arr[0]['hp_type'] == 28) { //是货品类型
                        dj_record.setValue({ fieldId: 'custbody_mul_xjd_hp_status', value: '询价单已更新回写', ignoreFieldChange: true }); //记录货品询价单状态
                    } else if (hx_arr[0]['hp_type'] == 30) {
                        dj_record.setValue({ fieldId: 'custbody_mul_xjd_fy_status', value: '询价单已更新回写', ignoreFieldChange: true }); //记录费用询价单状态
                    }

                    for (var i = 0; i < hx_arr.length; i++) {
                        var xjd_item_id = hx_arr[i].xjd_item_id; //询价单明细行id
                        var dj_item_id = hx_arr[i].dj_item_id; //待回写单据明细行id
                        var xj_h_price = hx_arr[i].xj_h_price; //询价后价格

                        var dj_line = dj_record.findSublistLineWithValue({ sublistId: 'item', fieldId: 'id', value: dj_item_id });
                        dj_record.setSublistValue({ sublistId: 'item', fieldId: 'custcol_xj_h_price', value: xj_h_price, line: dj_line }); //设置单据询价后价格
                        dj_record.setSublistValue({ sublistId: 'item', fieldId: 'custcol_xj_res', value: '已更新', line: dj_line }); //设置单据询价结果

                        //当前询价单对应的货品行号
                        var xj_line = this_xjd_record.findSublistLineWithValue({ sublistId: hp_item_id, fieldId: 'id', value: xjd_item_id });
                        this_xjd_record.setSublistValue({ sublistId: hp_item_id, fieldId: 'custrecord_hx_hp_res', value: '已回写', line: xj_line }); //设置当前子行询价状态
                        this_xjd_record.setSublistValue({ sublistId: hp_item_id, fieldId: 'custrecord_xj_h_price', value: xj_h_price, line: xj_line }); //设置当前子行询价后价格
                    }
                    this_xjd_record.setValue({ fieldId: 'custrecord_xjd_status', value: 6, ignoreFieldChange: true }); //询价单状态已更新

                    dj_record.save();
                    this_xjd_record.save();

                    //判断是否有成本表, 如果没有需要去新建成本表
                    createCbJgd(this_xjd_record, hx_arr);

                    dialog.confirm({ title: '提示', message: '已成功回写询价价格' }).then(function (result) {
                        window.location.reload();
                    });
                } else {
                    dialog.alert({ title: '提示', message: '未找到对应的单据记录类型' });
                }
            } catch (e) {
                log.debug('backWrite', e);
                dialog.alert({ title: '提示', message: '回写询价单价格失败, 请联系管理员' });
            }
        }

        //是否有成本表, 如果没有需要去新建成本表
        function createCbJgd(xjd_record, hx_arr) {
            try {
                var custbody_main_currency = xjd_record.getValue({ fieldId: 'custrecord_xjd_currency' }) || 0; //币种
                var custbody_incoterm = xjd_record.getValue({ fieldId: 'custrecord_xjd_incoterm' }) || 0; //价格条件|国际贸易
                for (var i = 0; i < hx_arr.length; i++) {
                    var xj_h_price = hx_arr[i].xj_h_price; //询价后价格
                    var hp_type = hx_arr[i].hp_type; //货品大类
                    var hp_id = hx_arr[i].hp_id; //货品id

                    if (hp_type == 28) {//产品大类，库存货品=28
                        var cb_type = 'customrecord_costprice'; //产品成本价格单  
                        var filters = [
                            ['custrecord_costprice_item', 'anyof', hp_id], 'AND', //货品 
                            ['custrecord_costprice_cur', 'anyof', custbody_main_currency], 'AND', //币种
                            ['custrecord_costprice_priceitem', 'anyof', custbody_incoterm], //价格条件
                        ];
                        // var cbd_fields = { 'price_field': 'custrecord_costprice_price', 'hp_field': 'custrecord_costprice_item', 'currency_field': 'custrecord_costprice_cur', 'incoterm_field': 'custrecord_costprice_priceitem' };
                        var cbd_fields = { 'price_field': 'custrecord_cpcb_xszdj', 'hp_field': 'custrecord_costprice_item', 'currency_field': 'custrecord_costprice_cur', 'incoterm_field': 'custrecord_costprice_priceitem' };
                        var type_str = '产品';
                    } else if (hp_type == 30) { // serviceitem | otherchargeitem 运费成本价格单 不确定用哪个记录类型, 好像两个都有
                        var cb_type = 'customrecord_expense_cost'; //费用成本价格单  
                        var filters = [
                            ['custrecord_exp_cost_item', 'anyof', hp_id], 'AND', //货品 
                            ['custrecord_exp_cost_currency', 'anyof', custbody_main_currency], //币种
                        ];
                        var cbd_fields = { 'price_field': 'custrecord_exp_cost_price', 'hp_field': 'custrecord_exp_cost_item', 'currency_field': 'custrecord_exp_cost_currency' }; //价格
                        var type_str = '费用';
                    }
                    if (hp_type == 28 || hp_type == 30) {
                        var search_data = search.create({ type: cb_type, filters: filters, columns: ['internalid'] });
                        var cbd_id = null; //成本单id
                        search_data.run().each(function (res) {
                            cbd_id = res.getValue('internalid');
                            return false; // 只取第一个匹配项 默认应该只有一个单据
                        });

                        if (cbd_id) { //有成本价格单 直接更新价格
                            var cbd_record = record.load({ type: cb_type, id: cbd_id });
                            cbd_record.setValue({ fieldId: cbd_fields.price_field, value: xj_h_price }); //价格
                            if (hp_type == 28) { //是货品类型
                                cbd_record.setValue({ fieldId: 'custrecord_cpcb_jfcbj', value: hx_arr[i].custrecord_cpcb_jfcbj }); //供应链交付成本价
                                cbd_record.setValue({ fieldId: 'custrecord_cpcb_nbcbj', value: hx_arr[i].custrecord_cpcb_nbcbj }); //供应链内部成本价
                                cbd_record.setValue({ fieldId: 'custrecord_cpcb_cgjj', value: hx_arr[i].custrecord_cpcb_cgjj }); //供应链采购加价
                                cbd_record.setValue({ fieldId: 'custrecord_cpcb_hdsy', value: hx_arr[i].custrecord_cpcb_hdsy }); //汇兑损益
                                cbd_record.setValue({ fieldId: 'custrecord_cpcb_jlcbtz', value: hx_arr[i].custrecord_cpcb_jlcbtz }); //激励性成本调整
                                cbd_record.setValue({ fieldId: 'custrecord_cpcb_nbjsj', value: hx_arr[i].custrecord_cpcb_nbjsj }); //销售内部结算价
                                cbd_record.setValue({ fieldId: 'custrecord_cpcb_xsmlr', value: hx_arr[i].custrecord_cpcb_xsmlr }); //销售毛利润

                                cbd_record.setValue({ fieldId: 'custrecord_approval_status', value: 18 }); //审批状态 默认审批通过
                            } else if (hp_type == 30) {
                                cbd_record.setValue({ fieldId: 'custrecord_exp_cost_approval_status', value: 18 }); //审批状态 默认审批通过
                            }
                            cbd_record.save();
                            console.log('已更新' + type_str + '成本价格单价格');
                        } else { //去创建成本价格单
                            var cbd_record = record.create({ type: cb_type, isDynamic: true });
                            cbd_record.setValue({ fieldId: cbd_fields.hp_field, value: hp_id }); //货品
                            cbd_record.setValue({ fieldId: cbd_fields.price_field, value: xj_h_price }); //价格
                            cbd_record.setValue({ fieldId: cbd_fields.currency_field, value: custbody_main_currency }); //币种
                            if (hp_type == 28) {
                                if(custbody_incoterm == 0) custbody_incoterm = 7; //给个默认值 7 是无
                                cbd_record.setValue({ fieldId: cbd_fields.incoterm_field, value: custbody_incoterm }); //价格条件|国际贸易
                                cbd_record.setValue({ fieldId: 'custrecord_cpcb_jfcbj', value: hx_arr[i].custrecord_cpcb_jfcbj }); //供应链交付成本价
                                cbd_record.setValue({ fieldId: 'custrecord_cpcb_nbcbj', value: hx_arr[i].custrecord_cpcb_nbcbj }); //供应链内部成本价
                                cbd_record.setValue({ fieldId: 'custrecord_cpcb_cgjj', value: hx_arr[i].custrecord_cpcb_cgjj }); //供应链采购加价
                                cbd_record.setValue({ fieldId: 'custrecord_cpcb_hdsy', value: hx_arr[i].custrecord_cpcb_hdsy }); //汇兑损益
                                cbd_record.setValue({ fieldId: 'custrecord_cpcb_jlcbtz', value: hx_arr[i].custrecord_cpcb_jlcbtz }); //激励性成本调整
                                cbd_record.setValue({ fieldId: 'custrecord_cpcb_nbjsj', value: hx_arr[i].custrecord_cpcb_nbjsj }); //销售内部结算价
                                cbd_record.setValue({ fieldId: 'custrecord_cpcb_xsmlr', value: hx_arr[i].custrecord_cpcb_xsmlr }); //销售毛利润

                                cbd_record.setValue({ fieldId: 'custrecord_approval_status', value: 18 }); //审批状态 默认审批通过
                            } else if (hp_type == 30) {
                                cbd_record.setValue({ fieldId: 'custrecord_exp_cost_approval_status', value: 18 }); //审批状态 默认审批通过
                            }
                            cbd_record.setValue({ fieldId: 'owner', value: runtime.getCurrentUser().id }); //所有者
                            var cbd_id = cbd_record.save(); //新成本价格单id
                            console.log('已创建' + type_str + '成本价格单[' + cbd_id + ']');
                        }
                    }
                }
            } catch (e) {
                log.debug('createCbJgd', e);
                dialog.alert({ title: '提示', message: '新建/更新成本价格单错误, 请联系管理员' });
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
