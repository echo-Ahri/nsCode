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
            fieldChanged: fieldChanged,
            jumpFySqd: jumpFySqd,
        };

        var thisData = {}, changeField = {}; //存储当前对象记录的数据

        // 页面初始化时检查是否有提交结果并显示消息
        function pageInit(context) {
            thisData = context.currentRecord;
            console.log('pageInit');

            var item_type = 'item';
            var item_count = thisData.getLineCount({ sublistId: item_type });
            var lineuniquekey_arr = [];
            for (var i = 0; i < item_count; i++) {
                var lineuniquekey = thisData.getSublistValue({ sublistId: item_type, fieldId: 'lineuniquekey', line: i });
                if (lineuniquekey) lineuniquekey_arr.push(lineuniquekey); //每一行货品对应的 分配的供应id号
            }

            // console.log(lineuniquekey_arr);
            if (lineuniquekey_arr.length > 0) {
                function loopWithTimeout(lineuniquekey_arr) {
                    var host = url.resolveDomain({ hostType: url.HostType.APPLICATION });
                    var i = 0;
                    var max = lineuniquekey_arr.length; // 循环次数
                    var delay = 1000; // 延迟时间，单位毫秒
                    function iterate() {
                        if (i < max) {
                            var fpgy_id = lineuniquekey_arr[i];
                            var url = 'https://' + host + '/app/accounting/inventory/allocation/allocatedsupply.nl?ktransactionline=' + fpgy_id + '&ifrmcntnr=T';
                            var xhr = new XMLHttpRequest();
                            xhr.open('GET', url, true);
                            xhr.onreadystatechange = function () {
                                if (xhr.readyState === 4 && xhr.status === 200) {
                                    var parser = new DOMParser();
                                    var doc = parser.parseFromString(xhr.responseText, 'text/html'); // 解析HTML
                                    // console.log(doc.body); // 访问解析后的DOM
                                    var fpgy = doc.body.querySelectorAll('td.listtext a.dottedlink'); //每行货品对应的所有采购订单号链接
                                    // console.log('fpgy', fpgy);
                                    if (fpgy.length > 0) {
                                        var tranid = [], custbody_po_number = [], hgbm = [], sccs = [];
                                        for (var j = 0; j < fpgy.length; j++) {
                                            var cgdd_href = fpgy[j].getAttribute('href'); //每一行采购订单链接

                                            var regex = new RegExp('[?&]' + 'id' + '=([^&#]*)', 'i');
                                            var cgdd_id_data = regex.exec(cgdd_href);
                                            var cgdd_id = cgdd_id_data[1]; //采购订单号
                                            console.log('cgdd_id_j_' + j, cgdd_id);
                                            var cg_info = getCgInfoById(cgdd_id);

                                            if (!isEmpty(cg_info.tranid)) tranid.push(cg_info.tranid);
                                            if (!isEmpty(cg_info.custbody_po_number)) custbody_po_number.push(cg_info.custbody_po_number);
                                            if (!isEmpty(cg_info.hgbm)) hgbm.push(cg_info.hgbm);
                                            if (!isEmpty(cg_info.sccs)) sccs.push(cg_info.sccs);
                                        }
                                        if (!isEmpty(tranid)) var tranid_str = tranid.join(', '); //拼接采购订单号
                                        if (!isEmpty(custbody_po_number)) var custbody_po_number_str = custbody_po_number.join(', '); //拼接采购合同号
                                        if (!isEmpty(hgbm)) var hgbm_str = hgbm.join(', '); //拼接采购海关编码
                                        if (!isEmpty(sccs)) var sccs_str = sccs.join(', '); //拼接采购生产厂商

                                        setOrderInfo(fpgy_id, tranid_str, custbody_po_number_str, hgbm_str, sccs_str);
                                    }
                                }
                            };
                            xhr.send();

                            i++;
                            setTimeout(iterate, delay); // 在每次迭代后设置下一次迭代的延迟
                        } else {
                            console.log('st循环结束');
                        }
                    }
                    iterate(); // 启动循环
                }
                loopWithTimeout(lineuniquekey_arr);
            }
        }

        function fieldChanged(context) {
            console.log('fieldChanged');
        }

        //跳转销售费用申请单
        function jumpFySqd(recId, recTyp) {
            dialog.confirm({
                title: '提示',
                message: '确认提示, 点击[OK]将跳转至销售费用申请单页面.',
            }).then(function (result) {
                if (result) {
                    var host = url.resolveDomain({ hostType: url.HostType.APPLICATION });

                    window.open(
                        'https://' + host + '/app/common/custom/custrecordentry.nl?rectype=1938&xsdd_id=' + recId,
                        '_blank'
                    );
                }
                return true;
            });
        }

        //根据采购订单id获取采购信息
        function getCgInfoById(cg_id) {
            console.log('getCgInfoById', cg_id);
            var cg_data = record.load({ type: 'purchaseorder', id: cg_id }); //采购订单类型

            var tranid = '', custbody_po_number = '', hgbm = '', sccs = '';

            tranid = cg_data.getValue({ fieldId: 'tranid' }); //采购订单号
            custbody_po_number = cg_data.getValue({ fieldId: 'custbody_po_number' }); //采购合同号

            var item_type = 'item';
            var item_count = cg_data.getLineCount({ sublistId: item_type });
            for (var i = 0; i < item_count; i++) {
                var custcol_txn_hscode = cg_data.getSublistValue({ sublistId: item_type, fieldId: 'custcol_txn_hscode', line: i }); //海关编码
                var custcol_txn_place_of_origin = cg_data.getSublistValue({ sublistId: item_type, fieldId: 'custcol_txn_place_of_origin', line: i }); //生产厂商
                var custcol_txn_place_of_origin_display = cg_data.getSublistValue({ sublistId: item_type, fieldId: 'custcol_txn_place_of_origin_display', line: i }); //生产厂商

                if (!isEmpty(custcol_txn_hscode)) hgbm += custcol_txn_hscode + ',';
                if (!isEmpty(custcol_txn_place_of_origin_display)) sccs += custcol_txn_place_of_origin_display + ',';
            }
            hgbm = hgbm.replace(/,$/, ' ');
            sccs = sccs.replace(/,$/, ' ');

            return { 'tranid': tranid, 'custbody_po_number': custbody_po_number, 'hgbm': hgbm, 'sccs': sccs };
        }

        //根据采购订单信息设置销售信息
        function setOrderInfo(fpgy_id, tranid, custbody_po_number, hgbm, sccs) {
            console.log('setOrderInfo', fpgy_id, tranid, custbody_po_number, hgbm, sccs);
            var item_type = 'item';
            var item_count = thisData.getLineCount({ sublistId: item_type });

            for (var i = 0; i < item_count; i++) {
                var lineuniquekey = thisData.getSublistValue({ sublistId: item_type, fieldId: 'lineuniquekey', line: i });
                console.log('lineuniquekey', lineuniquekey);
                if (lineuniquekey == fpgy_id) { //是当前行
                    thisData.selectLine({ sublistId: item_type, line: i });
                    thisData.setCurrentSublistValue({ sublistId: item_type, fieldId: 'custcol_cg_order_num', value: tranid }); //设置 采购订单号    
                    thisData.setCurrentSublistValue({ sublistId: item_type, fieldId: 'custcol_cg_contract', value: custbody_po_number }); //设置 采购合同号    
                    thisData.setCurrentSublistValue({ sublistId: item_type, fieldId: 'custcol_txn_hscode', value: hgbm }); //设置 海关编码    
                    thisData.setCurrentSublistValue({ sublistId: item_type, fieldId: 'custcol_sccs_display', value: sccs }); //设置 生产厂商 custcol_sccs_display
                }
            }

            dialog.alert({ title: '提示', message: '单据从采购订单中获取数据成功, 请保存', });
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
