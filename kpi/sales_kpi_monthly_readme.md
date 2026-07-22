# 销售员工 KPI 第一阶段试运行说明

## 1. 本次新增文件

1. `src/Objects/gdd/customrecord_sales_kpi_monthly.xml`
2. `src/Objects/gdd/customscript_sales_kpi_monthly_calc_ss.xml`
3. `src/FileCabinet/SuiteScripts/guodingdong_jiaoben/test/sales_kpi_monthly_calc_ss.js`
4. `src/FileCabinet/SuiteScripts/guodingdong_jiaoben/test/sales_kpi_monthly_readme.md`
5. `src/FileCabinet/SuiteScripts/guodingdong_jiaoben/test/sales_kpi_monthly_test_plan.md`

## 2. KPI 结果表怎么用

本次新增一个自定义记录：

- 中文名称：`销售员工KPI月度结果表`
- Script ID：`customrecord_sales_kpi_monthly`

每一条记录代表：

- 一个销售人员
- 一个统计月份
- 一组月度 KPI 结果

脚本会按 `销售人员 + 统计月份` 做幂等更新：

- 已存在则更新
- 不存在则创建

因此重复执行脚本不会重复创建同一月份同一销售人员的结果。

## 3. 脚本怎么部署

本次新增脚本：

- 脚本文件：`/SuiteScripts/guodingdong_jiaoben/test/sales_kpi_monthly_calc_ss.js`
- Script ID：`customscript_sales_kpi_monthly_calc_ss`
- Deployment ID：`customdeploy_sales_kpi_monthly_calc_ss`

SDF 部署命令建议如下：

```powershell
npx suitecloud project:deploy --validate
```

如果你确认需要正式推送到目标 NetSuite 账号，再使用：

```powershell
npx suitecloud project:deploy
```

风险说明：

1. 这会把 `src/Objects/gdd/*` 和 `src/FileCabinet/SuiteScripts/guodingdong_jiaoben/test/*` 当前版本同步到目标账号。
2. 如果目标账号中已经有人手工改过同名对象或脚本，部署后会被当前项目版本覆盖。
3. 建议先在沙箱或测试账号部署，并先执行 `--validate`。

本次我没有替你自动执行部署。

## 4. 脚本参数怎么配置

脚本参数如下：

1. `custscript_skm_period`
   - 含义：手工指定统计月份
   - 格式：`YYYY-MM`
   - 留空时：默认统计上个月

2. `custscript_skm_opp_invalid_keywords`
   - 含义：无效商机状态关键词
   - 默认值：`关闭丢失,无效,closed lost,invalid`
   - 用途：过滤“新增有效商机数”

3. `custscript_skm_owner_fields`
   - 含义：销售归属字段候选列表
   - 默认值：`custbody_salesman,salesrep,employee`
   - 用途：脚本会按字段顺序择一取数，优先适配业务员自定义字段

4. `custscript_skm_contract_rec_type`
   - 含义：合同进度表自定义记录类型
   - 默认值：`customrecord_document_schedule_form`

5. `custscript_skm_contract_owner_field`
   - 含义：合同进度表中的销售负责人字段 ID

6. `custscript_skm_contract_due_field`
   - 含义：合同进度表中的应跟进日期字段 ID

7. `custscript_skm_contract_update_field`
   - 含义：合同进度表中的最近跟进日期或更新时间字段 ID

第 5 到第 7 个参数如果未配置，第 11 个 KPI 会先返回 `0`。

## 5. 当前 12 个指标取数口径

### 1. 销售订单金额

- 记录类型：Sales Order
- 条件：
  - `mainline = T`
  - `trandate` 在统计月份内
  - `salesrep = 销售人员`
  - `status != SalesOrd:C`
- 金额字段：当前脚本用 `amount`

### 2. 开票金额

- 记录类型：Invoice
- 条件：
  - `mainline = T`
  - `trandate` 在统计月份内
  - `salesrep = 销售人员`
- 金额字段：当前脚本用 `amount`

### 3. 毛利额

- 第一阶段优先尝试读取发票上的 `grossprofit`
- 如果当前账号不能直接读取该字段，则写 `0`
- 同时在结果备注和本文档中标注为待确认项

### 4. 毛利率

- 公式：`毛利额 / 开票金额`
- 开票金额为 `0` 时返回 `0`

### 5. 回款达成率

- 第一阶段口径：`统计月份内客户付款金额 / 统计月份内开票金额`
- 当前实现方式：
  - 先取“当前销售人员名下客户”
  - 再汇总这些客户在统计月份内的 `Customer Payment`
- 这是近似口径，不是逐发票精确归属

### 6. 应收逾期金额

- 记录类型：Invoice
- 条件：
  - `mainline = T`
  - `salesrep = 销售人员`
  - `amountremaining > 0`
  - `duedate <= 统计结束日期`
- 金额字段：`amountremaining`

### 7. 新增有效商机数

- 记录类型：Opportunity
- 条件：
  - `datecreated` 或 `expectedclosedate` 在统计月份内
  - `salesrep = 销售人员`
  - 状态文本不包含无效关键词
- 无效关键词来自脚本参数 `custscript_skm_opp_invalid_keywords`

### 8. 商机跟进及时率

- 第一阶段先预留
- 当前返回 `0`
- 原因：项目中未识别到统一的“最近跟进日期/下次跟进日期”字段

### 9. 报价转订单率

- 第一阶段口径：
  - 分母：统计月份内 Estimate 数量
  - 分子：统计月份内已通过 `createdfrom` 关系转成 Sales Order 的 Estimate 数量
- 说明：
  - 这是近似实现
  - 如果未来有更明确的报价转单标记字段，建议改为正式口径

### 10. 老客户复购率

- 第一阶段口径：
  - 老客户定义：统计开始日期之前已经有 Sales Order 的客户
  - 分母：该销售人员历史老客户数
  - 分子：这些老客户中在统计月份内又下过 Sales Order 的客户数

### 11. 合同执行进度跟进及时率

- 当前项目中已识别到疑似合同/单证进度表：`customrecord_document_schedule_form`
- 但还没有确认：
  - 销售负责人字段
  - 应跟进日期字段
  - 最近跟进日期字段
- 未确认前当前返回 `0`
- 如果后续把 3 个字段参数配置完整，脚本会尝试按：
  - 分母：统计月内应跟进的合同进度记录数
  - 分子：最近跟进日期 <= 应跟进日期的记录数

### 12. 单据填写完整率

- 第一阶段只检查 Sales Order
- 检查字段：
  - `entity`
  - `salesrep`
  - `trandate`
  - `item` 子列表至少 1 行
  - `total`
- 完整率：
  - 完整销售订单数 / 统计月份内销售订单数

## 6. 哪些指标属于第一阶段近似口径

以下指标目前是近似口径或预留口径：

1. 毛利额
2. 回款达成率
3. 商机跟进及时率
4. 报价转订单率
5. 老客户复购率
6. 合同执行进度跟进及时率
7. KPI 总分

## 7. 后续需要业务确认的字段和规则

建议你在 NetSuite 中确认以下内容：

1. 毛利额到底取哪个系统字段
   - 是否直接用 `grossprofit`
   - 是按 Invoice 还是按 Sales Order
   - 是否税前/税后

2. 回款归属规则
   - 是按客户当前销售负责人
   - 还是按发票销售人员
   - 还是按付款核销到的发票来精确归属

3. 商机跟进及时率所需字段
   - 最近跟进日期字段
   - 下次跟进日期字段
   - 或者是否改用 Activity 记录统计

4. 报价转订单率正式口径
   - 是否允许按 `createdfrom`
   - 是否有专门的报价转单状态

5. 合同执行进度跟进及时率字段
   - 合同进度表销售负责人字段 ID
   - 应跟进日期字段 ID
   - 最近跟进日期字段 ID

6. KPI 总分公式
   - 每个 KPI 权重
   - 是否有封顶/保底
   - 是否需要按部门不同公式

## 8. 如何在 NetSuite 中测试

建议顺序：

1. 先在测试账号或沙箱部署
2. 打开 Script Deployment：`customdeploy_sales_kpi_monthly_calc_ss`
3. 先不设调度，状态保持 `Not Scheduled`
4. 配置 `custscript_skm_period`
5. 选择一个有订单、发票、付款、商机、报价数据的月份
6. 手动执行一次
7. 到自定义记录 `customrecord_sales_kpi_monthly` 检查结果
8. 再重复执行一次，确认是更新不是重复创建

## 9. 如何回滚或停用脚本

### 停用

最简单的停用方式：

1. 在 Script Deployment 上取消勾选 `Deployed`
2. 或把 Deployment 状态保留为 `Not Scheduled` 且不手动执行

### 回滚

如果你要回滚本次功能：

1. 从项目中移除这次新增的 5 个文件
2. 再执行一次 SDF 部署
3. 如账号中已生成 KPI 结果数据，需在 NetSuite UI 中手工处理已有记录

注意：

- 删除 SDF 文件不会自动删除账号里历史业务数据
- 如果需要真正删除账号中的自定义记录类型或脚本对象，请先在测试环境验证影响

## 10. Phase-1 KPI Metric Rules (Locked)

The current phase-1 implementation follows these temporary rules:

1. Sales Order Amount
- Record type: `Sales Order`
- Filters: `mainline=T`, `trandate` in period, owner field matches rep, status != cancelled
- Amount field: `amount` (compatible with `total` semantics on mainline)

2. Invoice Amount
- Record type: `Invoice`
- Filters: `mainline=T`, `trandate` in period, owner field matches rep
- Amount field: `amount`

3. Gross Profit
- Try system column `grossprofit`.
- If unavailable, write `0` and keep a memo note for follow-up cost-caliber confirmation.

4. Gross Margin
- Formula: `gross_profit / invoice_amount`.
- If invoice amount is `0`, return `0`.

5. Collection Achievement Rate
- Phase-1 formula: `customer payment amount in period / invoice amount in period`.
- Uses customer linkage as an approximation when strict payment-to-rep mapping is unavailable.

6. Overdue A/R Amount
- Record type: `Invoice`
- Filters: `mainline=T`, `amountremaining > 0`, `duedate <= period end`, owner field matches rep
- Field: `amountremaining`

7. New Valid Opportunity Count
- Record type: `Opportunity`
- Filters: `datecreated` or `expectedclosedate` in period, owner field matches rep
- Invalid/closed-lost status keywords are configurable.

8. Opportunity Follow-up Timeliness
- Placeholder in phase-1.
- Returns `0` when no unified follow-up fields are confirmed.

9. Quote-to-Order Rate
- Phase-1 formula: converted `Estimate` count / total `Estimate` count in period.
- Uses `createdfrom` approximation and keeps a memo note about the limitation.

10. Existing-Customer Repurchase Rate
- Formula: customers with period SO and historical SO / all historical customers for the rep.
- Historical means before period start.

11. Contract Execution Follow-up Timeliness
- If contract progress record/fields are not configured, return `0` and memo note.

12. Document Completion Rate
- Checks Sales Order completeness for: `entity`, `salesrep`, `trandate`, item lines, and amount/total presence.
- Formula: complete SO count / period SO count.
