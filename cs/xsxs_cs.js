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

            var submitconvert_dom = document.getElementById('tbl_submitconvert'); //保存并转换按钮
            var secondarysubmitconvert_dom = document.getElementById('tbl_secondarysubmitconvert'); //保存并转换按钮
            if (!(submitconvert_dom === null)) {
                submitconvert_dom.parentElement.style.display = "none";
                secondarysubmitconvert_dom.parentElement.style.display = "none";
            }
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
                dialog.alert({ title: '提示', message: is_tj_str });
                return false;
            }

            var email = thisData.getValue({ fieldId: 'email' });
            var phone = thisData.getValue({ fieldId: 'phone' });
            var is_repeat = false; //默认不重复
            var custentity_is_repeat = 1; //1不重复 2已重复

            if (!isEmpty(email)) { //有填写邮件需要检验 先取@后域名 不是类似qq的域名(排除的域DUPE_EXCLUDED_DOMAINS) 直接根据后缀去查 否则查所有
                // 是类似xx@qq.com第三方平台的邮箱, 就查全部邮箱地址
                var filters = [
                    ['isinactive', 'IS', 'F']
                    // , 'AND', ['stage', 'ANYOF', ['LEAD']] //['LEAD', 'PROSPECT', 'CUSTOMER'] 
                ];

                var this_id = context.currentRecord.id;
                if (this_id) { //排除编辑时 自己
                    filters.push('AND');
                    filters.push(['internalid', 'NONEOF', this_id]);
                }

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

                    is_repeat = true; //重复
                    custentity_is_repeat = 2;
                    return false;
                });
            }

            if (!isEmpty(phone)) {
                var filters = [
                    ['isinactive', 'IS', 'F']
                    , 'AND', ['phone', 'IS', phone]
                ];

                var this_id = context.currentRecord.id;
                if (this_id) { //排除编辑时 自己
                    filters.push('AND');
                    filters.push(['internalid', 'NONEOF', this_id]);
                }

                var search_data = search.create({ type: 'customer', filters: filters, columns: ['internalid', 'salesrep', 'phone', 'datecreated'] });
                search_data.run().each(function (res) {
                    salesrep_tel = res.getValue('salesrep'); //能查到

                    is_repeat = true; //重复
                    custentity_is_repeat = 2;
                    return false;
                });
            }

            thisData.setValue({ fieldId: 'custentity_is_repeat', value: custentity_is_repeat }); //写入 是否重复
            if (is_repeat) {
                return window.confirm('检索到电子邮箱|电话已在 销售线索|潜在客户|客户 中重复, 确认将保存为已重复!');
            } else {
                return true;
            }
        }

        function xsZhKh(rec_id, rec_type, zh_type) {
            console.log('xsZhKh');

            this_record = record.load({ type: rec_type, id: rec_id, isDynamic: true });

            var email = this_record.getValue({ fieldId: 'email' });
            var phone = this_record.getValue({ fieldId: 'phone' });
            var custentity_is_repeat = this_record.getValue({ fieldId: 'custentity_is_repeat' });
            var approveStatus = this_record.getValue({ fieldId: 'approveStatus' });
            if (!isEmpty(email) && !isEmpty(phone)) { //有填写邮件需要检验 先取@后域名 不是类似qq的域名(排除的域DUPE_EXCLUDED_DOMAINS) 直接根据后缀去查 否则查所有
                if (custentity_is_repeat == 2) {
                    dialog.confirm({ title: '提示', message: '检测到此销售线索已标记重复' }).then(function (result) {
                        if (result) {
                            if (approveStatus == 3) { //审批通过
                                if (zh_type == 'GS') {
                                    dialog.confirm({ title: '提示', message: '此销售线索未重复, 且是公司类型, 点击[Ok]将直接转换为潜在客户' }).then(function (result) {
                                        if (result) {
                                            this_record.setValue({ fieldId: 'entitystatus', value: 22 }); //写为潜在客户 潜在客户-Active - New Prospect
                                            this_record.save();
                                            window.location.reload();
                                        }
                                    });
                                } else { //个人跳转链接去转换
                                    dialog.confirm({ title: '提示', message: '此销售线索未重复, 且是个人类型, 点击[Ok]将跳转至链接转换为潜在客户' }).then(function (result) {
                                        if (result) {
                                            this_record.save();
                                            window.location.href = '/app/crm/sales/convertlead.nl?id=' + rec_id;
                                        }
                                    });
                                }
                            } else {
                                dialog.alert({ title: '提示', message: '当前销售线索状态未审批通过, 不能去转换客户!' });
                            }
                        } else {
                            dialog.alert({ title: '提示', message: '点击取消, 不去转换客户!' });
                        }
                    });
                } else {
                    if (zh_type == 'GS') {
                        dialog.confirm({ title: '提示', message: '此销售线索未重复, 且是公司类型, 点击[Ok]将直接转换为潜在客户' }).then(function (result) {
                            if (result) {
                                this_record.setValue({ fieldId: 'entitystatus', value: 22 }); //写为潜在客户 潜在客户-Active - New Prospect
                                this_record.save();
                                window.location.reload();
                            }
                        });
                    } else { //个人跳转链接去转换
                        dialog.confirm({ title: '提示', message: '此销售线索未重复, 且是个人类型, 点击[Ok]将跳转至链接转换为潜在客户' }).then(function (result) {
                            if (result) {
                                this_record.save();
                                window.location.href = '/app/crm/sales/convertlead.nl?id=' + rec_id;
                            }
                        });
                    }
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
