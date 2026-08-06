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
            sqThEdit: sqThEdit,
        };

        var thisData = {}; //存储当前对象记录的数据

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

        // 页面初始化时检查是否有提交结果并显示消息
        function pageInit(context) {
            thisData = context.currentRecord;
            console.log('pageInit');
        }

        function fieldChanged(context) {
            console.log('fieldChanged');
            var change_field = context.fieldId; //当前改变的字段
        }

        // 保存记录时的验证逻辑
        function saveRecord(context) {
            console.log('saveRecord');

            var type = thisData.type;
            if (type != 'lead') { //if (type == 'prospect' || type == 'customer') { //lead销售线索 额外校验 
                var is_tj = true;
                var is_tj_str = '';
                var phone = thisData.getValue({ fieldId: 'phone' });
                var isperson = thisData.getValue({ fieldId: 'isperson' });
                var companyname = thisData.getValue({ fieldId: 'companyname' });
                var email = thisData.getValue({ fieldId: 'email' });
                var this_id = context.currentRecord.id;

                if (type == 'customer' && isEmpty(this_id)) {
                    dialog.alert({ title: '提示', message: '客户不允许新建, 请去创建销售线索转换!' });
                    return false;
                }

                var is_repeat = false; //默认不重复
                var custentity_is_repeat = 1; //1不重复 2已重复

                if (isEmpty(companyname)) {
                    is_tj = false;
                    is_tj_str += ' ' + '公司名称必须填写';
                }
                if (isEmpty(phone)) {
                    is_tj = false;
                    is_tj_str += ' ' + '电话必须填写';
                }

                // console.log('isperson', isperson);
                var custentity_lxr_dz_empty = true;
                if (isperson == 'F') { //是公司类型 需要校验地址
                    var addressbook_count = thisData.getLineCount({ sublistId: 'addressbook' });
                    if (addressbook_count <= 0) {
                        is_tj = false;
                        custentity_lxr_dz_empty = false;
                        is_tj_str += ' ' + '是公司类型 需要填写地址';
                    }

                    this_record = record.load({ type: type, id: this_id, isDynamic: true });
                    var contactroles_count = this_record.getLineCount({ sublistId: 'contactroles' });
                    if (contactroles_count <= 0) {  //公司类型校验子列表 个人类型名称已经是必填
                        is_tj = false;
                        custentity_lxr_dz_empty = false;
                        is_tj_str += ' ' + '是公司类型 需要填写联系人';
                    }
                } else {
                    var firstname = thisData.getValue({ fieldId: 'firstname' });
                    if (isEmpty(firstname)) {
                        is_tj = false;
                        is_tj_str += ' ' + '是个人类型 名称必须填写';
                    }
                }
                thisData.setValue({ fieldId: 'custentity_lxr_dz_empty', value: custentity_lxr_dz_empty }); //设置 检索的 联系人|地址是否已填写

                var xsdb_type = 'salesteam';
                var salesteam_count = thisData.getLineCount({ sublistId: xsdb_type });
                if (salesteam_count <= 0) {
                    is_tj = false;
                    is_tj_str += ' ' + '请设置销售团队, 勾选为主要!';
                } else {
                    var xsdbItemCount = thisData.getLineCount({ sublistId: xsdb_type }); // 获取子列表的行数 销售代表
                    var is_zy = false;
                    for (var i = 0; i < xsdbItemCount; i++) {
                        var is_zy_str = thisData.getSublistValue({ sublistId: xsdb_type, fieldId: 'isprimary', line: i });
                        if (is_zy_str) is_zy = true;
                    }
                    if (!is_zy) {
                        is_tj = false;
                        is_tj_str += ' ' + '销售代表不能为空, 请编辑勾选销售团队的主要人员!';
                    }
                }

                if (!is_tj) {
                    dialog.alert({ title: '提示', message: is_tj_str });
                    return false;
                }

                if (!isEmpty(email)) { //有填写邮件需要检验 先取@后域名 不是类似qq的域名(排除的域DUPE_EXCLUDED_DOMAINS) 直接根据后缀去查 否则查所有
                    // 是类似xx@qq.com第三方平台的邮箱, 就查全部邮箱地址
                    var filters = [
                        ['isinactive', 'IS', 'F']
                        // , 'AND', ['stage', 'ANYOF', ['PROSPECT', 'CUSTOMER']] //['LEAD', 'PROSPECT', 'CUSTOMER'] 
                    ];

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
