/**
 * 第七关的制度模型。
 *
 * 这里刻意只讨论“同样多的资源，是否值得拿出一部分维持秩序”：
 * 不引入学习、淘汰或繁衍。每次遇到的资源总价值固定为 50，K 是制度
 * 运转成本，C 是冲突造成的损失；账本使用长期随机相遇的均值场估算。
 */

export type InstitutionPolicyId = "none" | "light" | "medium" | "high";

export interface InstitutionPolicy {
  id: InstitutionPolicyId;
  label: string;
  /** 每份资源拿出多少用于维持制度。 */
  organizationCost: number;
  /** 鹰鹰争抢一次造成的损失。 */
  conflictCost: number;
  /** 制度成本后，每份资源还剩多少可分配。 */
  value: number;
  /** 16 个席位在该制度下的教学稳定鹰数。 */
  stableHawkCount: number;
}

export const INSTITUTION_POLICIES: readonly InstitutionPolicy[] = [
  { id: "none", label: "没有组织", organizationCost: 0, conflictCost: 100, value: 50, stableHawkCount: 8 },
  { id: "light", label: "轻度制裁", organizationCost: 5, conflictCost: 180, value: 45, stableHawkCount: 4 },
  { id: "medium", label: "中度制裁", organizationCost: 10, conflictCost: 320, value: 40, stableHawkCount: 2 },
  { id: "high", label: "重度制裁", organizationCost: 20, conflictCost: 480, value: 30, stableHawkCount: 1 },
] as const;

export const INSTITUTION_POPULATION = 16;
export const INSTITUTION_ENCOUNTERS = 8;
export const RESOURCE_PER_ENCOUNTER = 50;

export interface ExpectedLedgerOptions {
  /** 参与均值场计算的席位数；默认 16。 */
  populationSize?: number;
  /** 鹰的数量；缺省使用该制度的 16 席稳定鹰数。 */
  hawkCount?: number;
  /** 每轮遇到的资源份数；默认 8。 */
  encounters?: number;
}

export interface ExpectedLedger {
  policy: InstitutionPolicy;
  populationSize: number;
  hawkCount: number;
  hawkRatio: number;
  encounters: number;
  /** 所有资源份的总价值，固定为 encounters × 50。 */
  gross: number;
  /** 组织拿走的资源。 */
  organization: number;
  /** 均值场下鹰鹰相遇造成的冲突损失。 */
  conflictLoss: number;
  /** 分给个体的净收益。 */
  net: number;
  /** 账本结算后的总额；应与 gross 相等。 */
  totalResourceBefore: number;
  totalResourceAfter: number;
  /** 便于图表和 UI 的别名。 */
  resourceConservation: number;
}

export function getInstitutionPolicy(policy: InstitutionPolicyId | number): InstitutionPolicy {
  const found = typeof policy === "number"
    ? INSTITUTION_POLICIES[policy]
    : INSTITUTION_POLICIES.find((item) => item.id === policy);
  if (!found) throw new Error(`未知的制度档位: ${String(policy)}`);
  return found;
}

/**
 * 按长期随机相遇均值场计算制度账本：
 * gross = encounters × 50
 * organization = encounters × K
 * conflictLoss = encounters × C × p²
 * net = gross - organization - conflictLoss
 */
export function expectedLedger(
  policy: InstitutionPolicyId | number | InstitutionPolicy,
  options: ExpectedLedgerOptions = {},
): ExpectedLedger {
  const selected = typeof policy === "object" ? policy : getInstitutionPolicy(policy);
  const populationSize = options.populationSize ?? INSTITUTION_POPULATION;
  const hawkCount = options.hawkCount ?? selected.stableHawkCount;
  const encounters = options.encounters ?? INSTITUTION_ENCOUNTERS;
  if (!Number.isInteger(populationSize) || populationSize <= 0) {
    throw new Error("populationSize 必须是正整数");
  }
  if (!Number.isInteger(hawkCount) || hawkCount < 0 || hawkCount > populationSize) {
    throw new Error("hawkCount 必须是群体范围内的非负整数");
  }
  if (!Number.isInteger(encounters) || encounters < 0) {
    throw new Error("encounters 必须是非负整数");
  }
  const hawkRatio = hawkCount / populationSize;
  const gross = encounters * RESOURCE_PER_ENCOUNTER;
  const organization = encounters * selected.organizationCost;
  const conflictLoss = encounters * selected.conflictCost * hawkRatio ** 2;
  const net = gross - organization - conflictLoss;
  const totalResourceAfter = organization + conflictLoss + net;
  return {
    policy: selected,
    populationSize,
    hawkCount,
    hawkRatio,
    encounters,
    gross,
    organization,
    conflictLoss,
    net,
    totalResourceBefore: gross,
    totalResourceAfter,
    resourceConservation: totalResourceAfter - gross,
  };
}

export function stableLedger(policy: InstitutionPolicyId | number): ExpectedLedger {
  return expectedLedger(policy);
}
