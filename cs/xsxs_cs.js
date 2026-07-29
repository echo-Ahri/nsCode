/*
 * @Descripttion: 
 * @Author: dsp
 */
/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/search', 'N/record', 'N/log', 'N/ui/dialog', 'N/url'],
    function (runtime, search, record, log, dialog, url) {
        var EXPORT_OBJ = {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            saveRecord: saveRecord,
            xsZhKh: xsZhKh,
        };

        var DUPE_EXCLUDED_DOMAINS = [ //排除的域
            'adelphia',
            'altavista',
            'ameritech',
            'aol',
            'att',
            'attbi',
            'bellsouth',
            'bigfoot',
            'comcast',
            'cox',
            'earthlink',
            'excite',
            'gmail',
            'home',
            'hotmail',
            'ix.netcom',
            'juno',
            'lycos',
            'mail',
            'mindspring',
            'msn',
            'netscape',
            'netzero',
            'pacbell',
            'prodigy',
            'qwest',
            'sbcglobal',
            'swbell',
            'sympatico',
            'verizon',
            'worldnet.att',
            'yahoo',
            'qq',
        ];

        var thisData = {}; //存储当前对象记录的数据

        // 页面初始化时检查是否有提交结果并显示消息
        function pageInit(context) {
            thisData = context.currentRecord;
            console.log('pageInit');

            // var submitconvert_dom = document.getElementById('tbl_submitconvert'); //保存并转换按钮
            // var secondarysubmitconvert_dom = document.getElementById('tbl_secondarysubmitconvert'); //保存并转换按钮
            // if (!(submitconvert_dom === null)) {
            //     submitconvert_dom.parentElement.style.display = "none";
            //     secondarysubmitconvert_dom.parentElement.style.display = "none";
            // }
        }

        function fieldChanged(context) {
            console.log('fieldChanged');
            var change_field = context.fieldId; //当前改变的字段
        }

        // 保存记录时的验证逻辑
        function saveRecord(context) {
            console.log('saveRecord');

            var email = thisData.getValue({ fieldId: 'email' });
            var salesrep = '', salesrepName = '';
            if (!isEmpty(email)) { //有填写邮件需要检验 先取@后域名 不是类似qq的域名(排除的域DUPE_EXCLUDED_DOMAINS) 直接根据后缀去查 否则查所有
                // 是类似xx@qq.com第三方平台的邮箱, 就查全部邮箱地址
                var filters = [
                    ['isinactive', 'IS', 'F']
                ];
                var domain = email.split('@')[1].toLowerCase();
                var hz = domain.split('.')[0];
                // var hz = email.split('@')[1].split('.')[0]; //邮箱@后 .前的内容
                console.log('hz', hz);
                if (DUPE_EXCLUDED_DOMAINS.includes(hz)) { //是排除的域 例如qq这种第三方平台 查所有
                    filters.push('AND');
                    filters.push(['email', 'IS', email]); //查询电子邮箱
                } else {
                    filters.push('AND');
                    filters.push(['email', 'CONTAINS', '@' + domain]); //查询电子邮箱
                    // filters.push(['email', 'CONTAINS', hz]); //查询电子邮箱
                }
                var search_data = search.create({ type: 'customer', filters: filters, columns: ['internalid', 'salesrep', 'email'] });
                search_data.run().each(function (res) {
                    salesrep = res.getValue('salesrep'); //能查到
                    salesrepName = res.getText('salesrep');
                    return false;
                });
                if (!isEmpty(salesrep)) {
                    thisData.setValue({ fieldId: 'custentity10', value: salesrepName }); //所属业务员

                    var xsdb_type = 'salesteam';
                    var xsdbItemCount = thisData.getLineCount({ sublistId: xsdb_type }); // 获取子列表的行数 销售代表
                    for (var i = 0; i < xsdbItemCount; i++) {
                        thisData.removeLine({ sublistId: xsdb_type, line: i, ignoreRecalc: true }); //先删除所有销售代表
                    }
                    thisData.selectNewLine({ sublistId: xsdb_type });
                    thisData.setCurrentSublistValue({ sublistId: xsdb_type, fieldId: 'contribution', value: 100, ignoreFieldChange: true });
                    thisData.setCurrentSublistValue({ sublistId: xsdb_type, fieldId: 'employee', value: salesrep, ignoreFieldChange: true });
                    thisData.setCurrentSublistValue({ sublistId: xsdb_type, fieldId: 'salesrole', value: -2, ignoreFieldChange: true });
                    thisData.commitLine({ sublistId: xsdb_type });
                }
            }

            if (!isEmpty(salesrep)) {
                return window.confirm('检索到电子邮箱已在客户中重复, 将获取所属人[' + salesrepName + ']填写至当前所属业务员!');
            } else {
                return true;
            }
        }

        function xsZhKh(rec_id, rec_type) {
            console.log('xsZhKh');

            this_record = record.load({ type: rec_type, id: rec_id, isDynamic: true });

            var email = this_record.getValue({ fieldId: 'email' });
            var salesrep = '', salesrepName = '';
            if (!isEmpty(email)) { //有填写邮件需要检验 先取@后域名 不是类似qq的域名(排除的域DUPE_EXCLUDED_DOMAINS) 直接根据后缀去查 否则查所有
                // 是类似xx@qq.com第三方平台的邮箱, 就查全部邮箱地址
                var filters = [
                    ['isinactive', 'IS', 'F']
                ];
                var domain = email.split('@')[1].toLowerCase();
                var hz = domain.split('.')[0];
                // var hz = email.split('@')[1].split('.')[0]; //邮箱@后 .前的内容
                console.log('hz', hz);
                if (DUPE_EXCLUDED_DOMAINS.includes(hz)) { //是排除的域 例如qq这种第三方平台 查所有
                    filters.push('AND');
                    filters.push(['email', 'IS', email]); //查询电子邮箱
                } else {
                    filters.push('AND');
                    filters.push(['email', 'CONTAINS', '@' + domain]); //查询电子邮箱
                    // filters.push(['email', 'CONTAINS', hz]); //查询电子邮箱
                }
                var search_data = search.create({ type: 'customer', filters: filters, columns: ['internalid', 'salesrep', 'email'] });
                search_data.run().each(function (res) {
                    salesrep = res.getValue('salesrep'); //能查到
                    salesrepName = res.getText('salesrep');
                    return false;
                });
                if (!isEmpty(salesrep)) {
                    dialog.confirm({ title: '提示', message: '检索到电子邮箱已在客户中重复, 点击[OK]将获取对应所属人[' + salesrepName + ']填写至当前所属业务员后再跳转至转换客户!' }).then(function (result) {
                        if(result){
                            this_record.setValue({ fieldId: 'custentity10', value: salesrepName }); //所属业务员
        
                            var xsdb_type = 'salesteam';
                            var xsdbItemCount = this_record.getLineCount({ sublistId: xsdb_type }); // 获取子列表的行数 销售代表
                            for (var i = 0; i < xsdbItemCount; i++) {
                                this_record.removeLine({ sublistId: xsdb_type, line: i, ignoreRecalc: true }); //先删除所有销售代表
                            }
                            this_record.selectNewLine({ sublistId: xsdb_type });
                            this_record.setCurrentSublistValue({ sublistId: xsdb_type, fieldId: 'contribution', value: 100, ignoreFieldChange: true });
                            this_record.setCurrentSublistValue({ sublistId: xsdb_type, fieldId: 'employee', value: salesrep, ignoreFieldChange: true });
                            this_record.setCurrentSublistValue({ sublistId: xsdb_type, fieldId: 'salesrole', value: -2, ignoreFieldChange: true });
                            this_record.commitLine({ sublistId: xsdb_type });
                            this_record.save();

                            window.location.href = '/app/crm/sales/convertlead.nl?id=' + rec_id;
                        }else{
                            dialog.alert({ title: '提示', message: '点击取消, 不去转换客户!' });
                        }
                    });
                }
            }else{
                dialog.alert({ title: '提示', message: '未填写对应电子邮箱, 不能去转换客户!' });
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
