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
            sqThEdit: sqThEdit,
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

            var is_tj = true;
            var is_tj_str = '';
            var phone = thisData.getValue({ fieldId: 'phone' });
            var isperson = thisData.getValue({ fieldId: 'isperson' });
            var companyname = thisData.getValue({ fieldId: 'companyname' });

            if (isEmpty(companyname)) {
                is_tj = false;
                is_tj_str += ' ' + '公司名称必须填写';
            }
            if (isEmpty(phone)) {
                is_tj = false;
                is_tj_str += ' ' + '电话必须填写';
            }

            if (isperson == 'F') { //是公司类型 需要校验地址
                // var addressbook_count = thisData.getLineCount({ sublistId: 'addressbook' });
                // console.log('addressbook_count', addressbook_count);
                // if (addressbook_count <= 0) {
                //     is_tj = false;
                //     is_tj_str += ' ' + '是公司类型 需要填写地址';
                // }

                // var contactroles_count = thisData.getLineCount({ sublistId: 'contactroles' });
                // console.log('contactroles_count', contactroles_count);
                // if (contactroles_count <= 0) {  //公司类型校验子列表 个人类型名称已经是必填
                //     is_tj = false;
                //     is_tj_str += ' ' + '是公司类型 需要填写联系人';
                // }
            } else {
                var firstname = thisData.getValue({ fieldId: 'firstname' });
                if (isEmpty(firstname)) {
                    is_tj = false;
                    is_tj_str += ' ' + '是个人类型 名称必须填写';
                }
            }

            if (!is_tj) {
                return window.confirm(is_tj_str);
            }

            var email = thisData.getValue({ fieldId: 'email' });
            var phone = thisData.getValue({ fieldId: 'phone' });
            var salesrep = '', salesrepName = '';
            var salesrep_tel = '', salesrepName_tel = '';
            var create_date = '', create_date_tel = '';
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
                var search_data = search.create({ type: 'customer', filters: filters, columns: ['internalid', 'salesrep', 'email', 'datecreated'] });
                search_data.run().each(function (res) {
                    salesrep = res.getValue('salesrep'); //能查到
                    create_date = res.getValue('datecreated'); //时间
                    salesrepName = res.getText('salesrep');
                    return false;
                });
            }

            if (!isEmpty(phone)) {
                var filters = [
                    ['isinactive', 'IS', 'F']
                    , 'AND', ['phone', 'IS', phone]
                ];
                var search_data = search.create({ type: 'customer', filters: filters, columns: ['internalid', 'salesrep', 'phone', 'datecreated'] });
                search_data.run().each(function (res) {
                    salesrep_tel = res.getValue('salesrep'); //能查到
                    create_date_tel = res.getValue('datecreated'); //时间
                    salesrepName_tel = res.getText('salesrep');
                    return false;
                });
            }

            var ssr = '', ssr_name = '';
            if (!isEmpty(salesrep) && !isEmpty(salesrep_tel)) {
                if (salesrep == salesrep_tel) {
                    ssr = salesrep;
                    ssr_name = salesrepName;
                } else { //判断那个先创建
                    console.log('create_date', create_date, 'create_date_tel', create_date_tel);
                    if (create_date > create_date_tel) {
                        ssr = salesrep_tel;
                        ssr_name = salesrepName_tel;
                    } else {
                        ssr = salesrep;
                        ssr_name = salesrepName;
                    }
                }
            } else if (!isEmpty(salesrep) && isEmpty(salesrep_tel)) {
                ssr = salesrep;
                ssr_name = salesrepName;
            } else if (isEmpty(salesrep) && !isEmpty(salesrep_tel)) {
                ssr = salesrep_tel;
                ssr_name = salesrepName_tel;
            }

            if (!isEmpty(ssr)) {
                thisData.setValue({ fieldId: 'custentity_is_repeat', value: 2 }); //写入已重复

                thisData.setValue({ fieldId: 'custentity10', value: ssr_name }); //所属业务员

                var xsdb_type = 'salesteam';
                var xsdbItemCount = thisData.getLineCount({ sublistId: xsdb_type }); // 获取子列表的行数 销售代表
                for (var i = 0; i < xsdbItemCount; i++) {
                    thisData.removeLine({ sublistId: xsdb_type, line: i, ignoreRecalc: true }); //先删除所有销售代表
                }
                thisData.selectNewLine({ sublistId: xsdb_type });
                thisData.setCurrentSublistValue({ sublistId: xsdb_type, fieldId: 'contribution', value: 100, ignoreFieldChange: true });
                thisData.setCurrentSublistValue({ sublistId: xsdb_type, fieldId: 'employee', value: ssr, ignoreFieldChange: true });
                thisData.setCurrentSublistValue({ sublistId: xsdb_type, fieldId: 'salesrole', value: -2, ignoreFieldChange: true });
                thisData.commitLine({ sublistId: xsdb_type });
            }

            if (!isEmpty(ssr)) {
                return window.confirm('检索到电子邮箱|电话已在客户中重复, 将获取所属人[' + ssr_name + ']填写至当前所属业务员!');
            } else {
                return true;
            }
        }

        function xsZhKh(rec_id, rec_type, zh_type) {
            console.log('xsZhKh');

            this_record = record.load({ type: rec_type, id: rec_id, isDynamic: true });

            var email = this_record.getValue({ fieldId: 'email' });
            var phone = thisData.getValue({ fieldId: 'phone' });
            var salesrep = '', salesrepName = '';
            var salesrep_tel = '', salesrepName_tel = '';
            var create_date = '', create_date_tel = '';
            if (!isEmpty(email) && !isEmpty(phone)) { //有填写邮件需要检验 先取@后域名 不是类似qq的域名(排除的域DUPE_EXCLUDED_DOMAINS) 直接根据后缀去查 否则查所有
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
                var search_data = search.create({ type: 'customer', filters: filters, columns: ['internalid', 'salesrep', 'email', 'datecreated'] });
                search_data.run().each(function (res) {
                    salesrep = res.getValue('salesrep'); //能查到
                    create_date = res.getValue('datecreated'); //时间
                    salesrepName = res.getText('salesrep');
                    return false;
                });

                var filters = [
                    ['isinactive', 'IS', 'F']
                    , 'AND', ['phone', 'IS', phone]
                ];
                var search_data = search.create({ type: 'customer', filters: filters, columns: ['internalid', 'salesrep', 'phone', 'datecreated'] });
                search_data.run().each(function (res) {
                    salesrep_tel = res.getValue('salesrep'); //能查到
                    create_date_tel = res.getValue('datecreated'); //时间
                    salesrepName_tel = res.getText('salesrep');
                    return false;
                });

                var ssr = '', ssr_name = '';
                if (!isEmpty(salesrep) && !isEmpty(salesrep_tel)) {
                    if (salesrep == salesrep_tel) {
                        ssr = salesrep;
                        ssr_name = salesrepName;
                    } else { //判断那个先创建
                        console.log('create_date', create_date, 'create_date_tel', create_date_tel);
                        if (create_date > create_date_tel) {
                            ssr = salesrep_tel;
                            ssr_name = salesrepName_tel;
                        } else {
                            ssr = salesrep;
                            ssr_name = salesrepName;
                        }
                    }
                } else if (!isEmpty(salesrep) && isEmpty(salesrep_tel)) {
                    ssr = salesrep;
                    ssr_name = salesrepName;
                } else if (isEmpty(salesrep) && !isEmpty(salesrep_tel)) {
                    ssr = salesrep_tel;
                    ssr_name = salesrepName_tel;
                }

                if (!isEmpty(ssr)) {
                    // dialog.confirm({ title: '提示', message: '检索到电子邮箱已在客户中重复, 点击[OK]将获取对应所属人[' + ssr_name + ']填写至当前所属业务员后再跳转至转换客户!' }).then(function (result) {
                    dialog.confirm({ title: '提示', message: '检索到电子邮箱已在客户中重复, 点击[OK]将获取对应所属人[' + ssr_name + ']填写至当前所属业务员并标记为已重复!' }).then(function (result) {
                        if (result) {
                            this_record.setValue({ fieldId: 'custentity_is_repeat', value: 2 }); //写入已重复

                            this_record.setValue({ fieldId: 'custentity10', value: ssr_name }); //所属业务员

                            var xsdb_type = 'salesteam';
                            var xsdbItemCount = this_record.getLineCount({ sublistId: xsdb_type }); // 获取子列表的行数 销售代表
                            for (var i = 0; i < xsdbItemCount; i++) {
                                this_record.removeLine({ sublistId: xsdb_type, line: i, ignoreRecalc: true }); //先删除所有销售代表
                            }
                            this_record.selectNewLine({ sublistId: xsdb_type });
                            this_record.setCurrentSublistValue({ sublistId: xsdb_type, fieldId: 'contribution', value: 100, ignoreFieldChange: true });
                            this_record.setCurrentSublistValue({ sublistId: xsdb_type, fieldId: 'employee', value: ssr, ignoreFieldChange: true });
                            this_record.setCurrentSublistValue({ sublistId: xsdb_type, fieldId: 'salesrole', value: -2, ignoreFieldChange: true });
                            this_record.commitLine({ sublistId: xsdb_type });
                            
                            var approveStatus = this_record.getValue('custentity33'); //审批状态
                            if(approveStatus == 3){
                                if(zh_type == 'GS'){
                                    this_record.setValue({ fieldId: 'entitystatus', value: 38 }); //写为潜在客户 潜在客户-Active - New Prospect
                                }else{ //个人跳转链接去转换
                                    window.location.href = '/app/crm/sales/convertlead.nl?id=' + rec_id;
                                }
                            } //审批通过
                            this_record.save();
                        } else {
                            dialog.alert({ title: '提示', message: '点击取消, 不去转换客户!' });
                        }
                    });
                }else{
                    window.location.href = '/app/crm/sales/convertlead.nl?id=' + rec_id; //审批通过
                }
            } else {
                dialog.alert({ title: '提示', message: '未填写对应电子邮箱|电话, 不能去转换客户!' });
            }
        }

        //申请退回
        function sqThEdit(recId, recType) {
            var host = url.resolveDomain({ hostType: url.HostType.APPLICATION });
            suiteletUrl = 'https://' + host + '/app/site/hosting/scriptlet.nl?script=1383&deploy=1&rec_id=' + recId + '&rec_type=' + recType; //弹框url

            // 计算弹窗位置，使其居中显示
            var width = 500;
            var height = 360;
            var left = (screen.width - width) / 2;
            var top = (screen.height - height) / 2;

            // 打开弹窗
            window.open(suiteletUrl, '_blank', 'width=' + width + ',height=' + height + ',top=' + top + ',left=' + left + ',resizable=yes,scrollbars=yes');
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
