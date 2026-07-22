/**
 *@NApiVersion 2.x
 *@NScriptType MapReduceScript
 */

define(['N/file', 'N/runtime', 'N/log', 'N/search', 'N/record'],

    function (file, runtime, log, search, record) {

        function getInputData() { //相当于格式化数据 生成键值对
            var yg_id = runtime.getCurrentScript().getParameter({ name: 'custscript_yg_id' });
            var ywy_kcb_id = runtime.getCurrentScript().getParameter({ name: 'custscript_ywy_kcb_id' });
            log.audit('员工执行', '员工[' + yg_id + ']');

            //再查看当前用户分配表下有没有业务员库存分配行 customrecord_person_assignment_line
            var filters = [ //是否库存货品
                ['custitem_is_kc_fp', 'IS', 'T']
            ];
            //先查出是库存货品
            var kchp_data = search.create({ type: 'lotnumberedinventoryitem', filters: filters, columns: ['internalid'] });
            var kchp_id_arr = []; //所有是库存货品的货品id
            kchp_data.run().each(function (res) { //查出所有是库存货品的货品
                var kchp_id = res.getValue('internalid');
                if (!isEmpty(kchp_id)) {
                    kchp_id_arr.push(kchp_id);
                }
                return true; //必须有返回值, 不然只有第一条
            });

            var obj = {};
            for (var i = 0; i < kchp_id_arr.length; i++) {
                obj[kchp_id_arr[i]] = JSON.stringify({ 'yg_id': yg_id, 'ywy_kcb_id': ywy_kcb_id });
            }
            return obj;
        }

        function map(context) { //执行键值对的函数
            var hp_id = context.key;
            var yg_info = JSON.parse(context.value);
            
            var ywy_kcb_id = yg_info.ywy_kcb_id;
            var yg_id = yg_info.yg_id;
            
            try {
                //查询当前库存货品是否有分配行
                var filters = [ //是否库存货品
                    ['custrecord_pal_pat', 'ANYOF', ywy_kcb_id],
                    'AND', ['custrecord_pal_item', 'ANYOF', hp_id],
                    'AND', ['custrecord_pal_employee', 'ANYOF', yg_id]
                ];

                var search_data = search.create({ type: 'customrecord_person_assignment_line', filters: filters, columns: ['internalid'] });
                var kcfph_id = null;
                search_data.run().each(function (search_res) { //查询当前
                    kcfph_id = search_res.getValue('internalid');
                    return false;
                });
            } catch (e) {
                log.error('map_create_kcfph', e);
            }

            if (isEmpty(kcfph_id)) { //为空表示没查到, 需要去新建
                try {
                    var new_record = record.create({ type: 'customrecord_person_assignment_line', isDynamic: true });
                    new_record.setValue({ fieldId: 'custrecord_pal_pat', value: ywy_kcb_id }); //个人计划量分配表
                    new_record.setValue({ fieldId: 'custrecord_pal_item', value: hp_id }); //货品
                    new_record.setValue({ fieldId: 'custrecord_pal_employee', value: yg_id }); //所属员工
                    new_record.save(); //新业务员库存分配行id

                    log.audit('创建业务员库存表分配行成功', '货品[' + hp_id + '] 员工[' + yg_id + '] ');
                } catch (e) {
                    log.error('map_create_kcfph', e);
                }
            }
        }

        function reduce(context) { //再次执行上一步map的键值对

        }

        function summarize(context) { //执行时记录下

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