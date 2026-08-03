/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */

define(['N/ui/serverWidget', 'N/search', 'N/redirect', 'N/runtime', 'N/ui/message', 'N/record', 'N/url', 'N/log', 'N/file'],
	function (serverWidget, search, redirect, runtime, message, record, url, log, file,) {
		function onRequest(context) {
			if (context.request.method === 'GET') {
				var recId = context.request.parameters.rec_id;
				var recType = context.request.parameters.rec_type;
				var form = serverWidget.createForm({ title: '申请退回说明', hideNavBar: true });

				//文本区域框
				var commentTextArea = form.addField({ id: 'custpage_sqth_comment', type: serverWidget.FieldType.TEXTAREA, label: '申请退回说明', });
				commentTextArea.isMandatory = true; //设置为必填

				var hiddenId = form.addField({ id: 'custpage_rec_id', type: serverWidget.FieldType.TEXT, label: 'rec_id' });
				hiddenId.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
				hiddenId.defaultValue = recId;

				var hiddenType = form.addField({ id: 'custpage_rec_type', type: serverWidget.FieldType.TEXT, label: 'rec_type' });
				hiddenType.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
				hiddenType.defaultValue = recType;

				form.addSubmitButton({ label: '确认' });

				context.response.writePage(form);
			} else {
				var recId = context.request.parameters.custpage_rec_id;
				var recType = context.request.parameters.custpage_rec_type;
				var custpage_sqth_comment = context.request.parameters.custpage_sqth_comment;
				if (recId && recType) {
					var now = new Date();
					var timeString = now.toLocaleString();;
					var currentUser = runtime.getCurrentUser().name;

					var comment = currentUser + '--' + timeString + '--申请退回:' + custpage_sqth_comment;

					try {
						//获取原有的意见内容
						var record_old = record.load({ type: recType, id: recId, isDynamic: true });
						var old_comment = record_old.getValue('custentity_kh_th_remark') || '';
						comment += '\n' + old_comment;

						//设置字段，直接写数据库
						record.submitFields({
							type: recType, id: recId,
							values: { 'custentity_kh_th_remark': comment, 'custentity33': 4 }, //申请退回状态
							options: { enableSourcing: false, ignoreMandatoryFields: true },
						});
					} catch (e) {
						context.response.write(`
							<script>
								alert('写入失败: ${e.message}');
								window.close();
							</script>
						`);
						return;
					}
				} else {
					context.response.write(`
						<script>
							alert('参数错误，请联系管理员。');
							window.close();
						</script>
					`);
					return;
				}

				//成功后：刷新父页面 + 关闭弹窗
				context.response.write(`
					<html>
					<body>
						<script>
							if (window.opener) {
								window.opener.location.reload();
							}
							window.close();
						</script>
					</body>
					</html>
				`);
			}
		}

		return { onRequest: onRequest };
	});