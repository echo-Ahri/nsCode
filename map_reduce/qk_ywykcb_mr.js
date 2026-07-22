/**
 *@NApiVersion 2.x
 *@NScriptType MapReduceScript
 */

define(['N/file', 'N/runtime', 'N/log', 'N/search', 'N/record'],

    function (file, runtime, log, search, record) { 

        function getInputData() { //相当于格式化数据 生成键值对
            var filters = [ //是否库存货品
                ['custitem_is_kc_fp', 'IS', 'T']
                , 'AND', ['internalid', 'ANYOF', 8360] //测试 P01SR-120FS测试形态0201
            ];
            //先查出库存货品
            var kchp_data = search.create({ type: 'lotnumberedinventoryitem', filters: filters, columns: ['internalid'] });
            var kchp_id_arr = []; //所有是库存货品的货品id
            kchp_data.run().each(function (res) { //查出所有是库存货品的货品
                var kchp_id = res.getValue('internalid');
                if (!isEmpty(kchp_id)) {
                    kchp_id_arr.push(kchp_id);
                }
                return true; //必须有返回值, 不然只有第一条
            });

            if (!isEmpty(kchp_id_arr)) { //再查出所有的业务员库存表
                var filters = [ //是否库存货品的库存表
                    ['isinactive', 'IS', 'F']
                    , 'AND', ['custrecord_pal_item', 'ANYOF', kchp_id_arr]
                    , 'AND', ['custrecord_pal_employee', 'ANYOF', 333] //测试 
                ];
                var kcb_data = search.create({ type: 'customrecord_person_assignment_line', filters: filters, columns: ['internalid'] });
                var kcb_id_arr = []; //所有是库存货品的货品库存表
                kcb_data.run().each(function (res) { //查出所有是库存货品的货品库存表
                    var kcb_id = res.getValue('internalid');
                    if (!isEmpty(kcb_id)) {
                        kcb_id_arr.push(kcb_id);
                    }
                    return true; //必须有返回值, 不然只有第一条
                });
            }

            var obj = {};
            for (var i = 0; i < kcb_id_arr.length; i++) {
                obj[i] = kcb_id_arr[i];
            }
            return obj;
        }

        function map(context) { //执行键值对的函数
            try {
                var index = context.key;
                var kcb_id = context.value;

                var last_month = getLastMonthYearMonth(); //下一月启动脚本, 获取的是上一月的数据

                var filters = [ //是否已经创建过当前货品表,当前月的记录了
                    ['isinactive', 'IS', 'F']
                    , 'AND', ['custrecord_kcb_id', 'ANYOF', kcb_id]
                    , 'AND', ['custrecord_this_month', 'IS', last_month]
                ];
                log.audit('filters', filters);
                var lsjl_data = search.create({ type: 'customrecord_hp_ljkc_history', filters: filters, columns: ['internalid'] });
                var lsjl_id = null //历史记录id
                lsjl_data.run().each(function (res) {
                    lsjl_id = res.getValue('internalid');
                    return false;
                });

                if (isEmpty(lsjl_id)) {
                    //先写入历史记录, 再清零
                    var kcb_record = record.load({ type: 'customrecord_person_assignment_line', id: kcb_id, isDynamic: true });
                    var custrecord_this_month_yg = kcb_record.getValue({ fieldId: 'custrecord_pal_employee' });
                    var custrecord_this_month_hp = kcb_record.getValue({ fieldId: 'custrecord_pal_item' });
                    var custrecord_this_month_dbr = kcb_record.getValue({ fieldId: 'custrecord556' });
                    var custrecord_this_month_dbc = kcb_record.getValue({ fieldId: 'custrecord_diaob_fp' });
                    var custrecord_this_month_qrl = kcb_record.getValue({ fieldId: 'custrecord_kc_qr_sl' });
                    var custrecord_this_month_xqsql = kcb_record.getValue({ fieldId: 'custrecord_month_xql' });
                    var custrecord_this_month_kcl = kcb_record.getValue({ fieldId: 'custrecord_ywy_jhl' });
                    var custrecord_this_month_zyl = kcb_record.getValue({ fieldId: 'custrecord_pal_yw_dose' });
                    var custrecord_this_month_syl = kcb_record.getValue({ fieldId: 'custrecord_pal_plan_ava_count' });

                    var new_record = record.create({ type: 'customrecord_hp_ljkc_history', isDynamic: true }); //货品逻辑库存历史记录
                    new_record.setValue({ fieldId: 'custrecord_kcb_id', value: kcb_id }); //库存表id
                    new_record.setValue({ fieldId: 'custrecord_this_month_yg', value: custrecord_this_month_yg }); //所属员工
                    new_record.setValue({ fieldId: 'custrecord_this_month_hp', value: custrecord_this_month_hp }); //货品
                    new_record.setValue({ fieldId: 'custrecord_this_month_dbr', value: custrecord_this_month_dbr }); //调拨入
                    new_record.setValue({ fieldId: 'custrecord_this_month_dbc', value: custrecord_this_month_dbc }); //调拨出
                    new_record.setValue({ fieldId: 'custrecord_this_month_qrl', value: custrecord_this_month_qrl }); //确认量
                    new_record.setValue({ fieldId: 'custrecord_this_month_xqsql', value: custrecord_this_month_xqsql }); //需求量
                    new_record.setValue({ fieldId: 'custrecord_this_month_kcl', value: custrecord_this_month_kcl }); //库存量
                    new_record.setValue({ fieldId: 'custrecord_this_month_zyl', value: custrecord_this_month_zyl }); //占用量
                    new_record.setValue({ fieldId: 'custrecord_this_month_syl', value: custrecord_this_month_syl }); //剩余量
                    new_record.setValue({ fieldId: 'custrecord_this_month', value: last_month }); //当前月的上一月
                    var new_id = new_record.save();

                    if (!isEmpty(new_id)) {
                        log.audit('创建库存表历史记录成功', '库存表ID[' + kcb_id + ']');
                        context.write({
                            key: index,
                            // value: kcb_id //提交相当于 [kcb_id]
                            value: kcb_id //提交相当于 [kcb_id]
                        });
                    }
                } else {
                    log.audit('已创建库存表历史记录', '历史记录ID[' + lsjl_id + ']');
                    context.write({
                        key: index,
                        // value: kcb_id //提交相当于 [kcb_id]
                        value: -1 //提交相当于 [kcb_id]
                    });
                }
            } catch (e) {
                log.error('map_create_lsjl', e);
            }
        }

        function reduce(context) { //再次执行上一步map的键值对
            try {
                var index = context.key;
                var kcb_id = context.values[0];

                if (kcb_id != -1) {
                    var kcb_record = record.load({ type: 'customrecord_person_assignment_line', id: kcb_id, isDynamic: true });

                    kcb_record.setValue({ fieldId: 'custrecord556', value: 0 });
                    kcb_record.setValue({ fieldId: 'custrecord_diaob_fp', value: 0 });
                    kcb_record.setValue({ fieldId: 'custrecord_kc_qr_sl', value: 0 });
                    kcb_record.setValue({ fieldId: 'custrecord_pal_yw_dose', value: 0 });

                    kcb_record.save();

                    log.audit('库存表归零成功', '库存表ID[' + kcb_id + ']');
                } else {
                    log.audit('库存表历史记录已存在', '重复执行');
                }
            } catch (e) {
                log.error('reduce_clear_kcb', e);
            }
        }

        function summarize(context) { //执行时记录下

        }

        function getLastMonthYearMonth() {
            var date = new Date();
            var year = date.getFullYear();
            var month = date.getMonth(); // 0-11

            // 如果当前是1月，则上一月是去年的12月
            if (month === 0) {
                month = 11;
                year -= 1;
            } else {
                month -= 1;
            }
            month += 1;
            if(month < 10) month = '0' + month;

            // 确保月份是两位数
            var formattedMonth = String(month);
            return year + '-' + formattedMonth;
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

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };
    });