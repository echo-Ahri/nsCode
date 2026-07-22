/**
 *@NApiVersion 2.x
 *@NScriptType MapReduceScript
 */

define(['N/file', 'N/runtime', 'N/log', 'N/search', 'N/record'],

    function (file, runtime, log, search, record) {

        function getInputData() { //相当于格式化数据 生成键值对
            var hp_id = runtime.getCurrentScript().getParameter({ name: 'custscript_hp_id' });
            log.audit('货品执行', '货品[' + hp_id + ']');

            //先取出有登录权限的员工 employee
            var filters = [ //当前业务员
                ['giveaccess', 'IS', 'T'] //有登录权限
                , 'AND', ['role', 'ANYOF', 1898] //销售业务专员
            ];
            var search_data = search.create({ type: 'employee', filters: filters, columns: ['internalid'] });
            var yg_id_arr = []; //所有可以登录的员工id
            search_data.run().each(function (res) {
                var yg_id = res.getValue('internalid');
                if (!isEmpty(yg_id)) {
                    yg_id_arr.push(yg_id);
                }

                return true; //必须有返回值, 不然只有第一条
            });
            yg_id_arr.push(732); //默认添加 公司账户
            yg_id_arr.push(12257); //默认添加 公司账户-分配库存用

            var obj = {};
            for (var i = 0; i < yg_id_arr.length; i++) {
                obj[yg_id_arr[i]] = hp_id;
            }
            return obj;
        }

        function map(context) { //执行键值对的函数
            try {
                var yg_id = context.key;
                var hp_id = context.value;

                var filters = [ //当前业务员
                    ['custrecord_pat_employee', 'ANYOF', yg_id] //业务员
                    , 'AND', ['isinactive', 'IS', 'F'] //不是非活动
                ];
                var search_data = search.create({ type: 'customrecord_person_assignment_table', filters: filters, columns: ['internalid'] });
                var ywy_kcb_id = null;
                search_data.run().each(function (res) { //先查员工有没有业务员库存表
                    ywy_kcb_id = res.getValue('internalid');
                    return false; // 只取第一个匹配项 默认应该只有一个单据
                });
                if (isEmpty(ywy_kcb_id)) { //没有业务员库存表 则 业务员库存分配行肯定也没有
                    try {
                        var new_record = record.create({ type: 'customrecord_person_assignment_table', isDynamic: true }); //先新建业务员库存表
                        new_record.setValue({ fieldId: 'custrecord_pat_xq_name', value: 5 }); //计划需求分配名称 5-个人计划需求 4-临时需求
                        new_record.setValue({ fieldId: 'custrecord_pat_employee', value: yg_id }); //业务员
                        new_record.setValue({ fieldId: 'custrecord671', value: 65 }); //业务员库存分配关联ID 业务员库存分配工作流审批人员配置
                        var new_kcb_id = new_record.save(); //新业务员库存表id

                        var new_record = record.create({ type: 'customrecord_person_assignment_line', isDynamic: true });
                        new_record.setValue({ fieldId: 'custrecord_pal_pat', value: new_kcb_id }); //个人计划量分配表
                        new_record.setValue({ fieldId: 'custrecord_pal_item', value: hp_id }); //货品
                        new_record.setValue({ fieldId: 'custrecord_pal_employee', value: yg_id }); //所属员工
                        new_record.save(); //新业务员库存分配行id

                        log.audit('创建业务员库存表分配行成功', '货品[' + hp_id + '] 员工[' + yg_id + '] ');
                    } catch (e) {
                        log.error('map_create_kcb', e);
                    }
                } else {
                    //再查询当前库存货品是否有分配行
                    var filters = [
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
                    if (isEmpty(kcfph_id)) { //为空表示没查到, 需要去新建
                        context.write({
                            key: yg_id,
                            // value: { 'hp_id': hp_id, 'ywy_kcb_id': ywy_kcb_id } //提交相当于 [{ 'hp_id': hp_id, 'ywy_kcb_id': ywy_kcb_id }]
                            value: JSON.stringify({ 'hp_id': hp_id, 'ywy_kcb_id': ywy_kcb_id }) //提交相当于 [{ 'hp_id': hp_id, 'ywy_kcb_id': ywy_kcb_id }]
                        });
                    }
                }
            } catch (e) {
                log.error('map_create_fph', e);
            }
        }

        function reduce(context) { //再次执行上一步map的键值对
            try {
                var yg_id = context.key;
                var hp_info = JSON.parse(context.values[0]);
                
                var ywy_kcb_id = hp_info.ywy_kcb_id;
                var hp_id = hp_info.hp_id;

                var new_record = record.create({ type: 'customrecord_person_assignment_line', isDynamic: true });

                new_record.setValue({ fieldId: 'custrecord_pal_pat', value: ywy_kcb_id }); //个人计划量分配表
                new_record.setValue({ fieldId: 'custrecord_pal_item', value: hp_id }); //货品
                new_record.setValue({ fieldId: 'custrecord_pal_employee', value: yg_id }); //所属员工
                new_record.save(); //新业务员库存分配行id

                log.audit('创建业务员分配行成功', '货品[' + hp_id + '] 员工[' + yg_id + '] ');
            } catch (e) {
                log.error('reduce_create_fph', e);
            }
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