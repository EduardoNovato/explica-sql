import { describe, expect, it } from 'vitest';
import { analysisOf, plans } from '../engine/fixtures';
import { maskLiterals } from './mask';

describe('ocultar valores literales', () => {
  it('cambia textos y números de las condiciones por ?', () => {
    const plan = [
      'Seq Scan on orders o  (cost=0.00..44076.00 rows=15 width=107) (actual time=12.418..185.330 rows=14 loops=1)',
      "  Filter: ((o.o_custkey = 74221) AND (o.o_comment ~~ '%urgente%'::text) AND (o.o_totalprice > -12.5))",
      '  Rows Removed by Filter: 1499986',
      'Execution Time: 185.512 ms',
    ].join('\n');
    expect(maskLiterals(plan).split('\n')).toEqual([
      'Seq Scan on orders o  (cost=0.00..44076.00 rows=15 width=107) (actual time=12.418..185.330 rows=14 loops=1)',
      "  Filter: ((o.o_custkey = ?) AND (o.o_comment ~~ '?'::text) AND (o.o_totalprice > ?))",
      '  Rows Removed by Filter: 1499986',
      'Execution Time: 185.512 ms',
    ]);
  });

  it('no toca nombres con números, parámetros, SubPlan ni modificadores de tipo', () => {
    const line = "  Filter: ((t1.col2 = $1) AND (NOT (hashed SubPlan 1)) AND ((total)::numeric(12,2) > '10'::numeric))";
    expect(maskLiterals(line)).toBe("  Filter: ((t1.col2 = $1) AND (NOT (hashed SubPlan 1)) AND ((total)::numeric(12,2) > '?'::numeric))");
  });

  it('oculta también en JSON, solo en las condiciones', () => {
    const masked = JSON.parse(maskLiterals(plans.nestedLoopJson)) as [{ Plan: { Plans: Record<string, unknown>[] } }];
    const inner = masked[0].Plan.Plans[1];
    expect(inner?.Filter).toBe('(p.cliente_id = c.id)');
    expect(inner?.['Rows Removed by Filter']).toBe(49999);

    const json = '[{"Plan": {"Node Type": "Seq Scan", "Relation Name": "orders", "Filter": "(o_custkey = 74221)", "Plan Rows": 15}}]';
    expect(JSON.parse(maskLiterals(json))[0].Plan).toMatchObject({ Filter: '(o_custkey = ?)', 'Plan Rows': 15 });
  });

  it('en Oracle oculta el texto de la consulta y los predicados, aunque estén partidos en varias líneas', () => {
    const masked = maskLiterals(plans.oracleHashSort);
    expect(masked).not.toContain('1998');
    expect(masked).toContain("l.l_shipdate >= DATE '?' ORDER BY");
    expect(masked).toContain(`   4 - filter("L"."L_SHIPDATE">=TO_DATE('?', '?'))`);
    expect(masked).toContain('   2 - access("O"."O_ORDERKEY"="L"."L_ORDERKEY")');
    // La tabla con los números del plan no se toca
    expect(masked).toContain('|*  4 |    TABLE ACCESS FULL| LINEITEM |      1 |    600K|    541K|00:00:02.12 |     110K|    108K|');

    const conversion = maskLiterals(plans.oracleImplicitConversion);
    expect(conversion).toContain('WHERE numero = ?');
    expect(conversion).toContain('   1 - filter(TO_NUMBER("NUMERO")=?)');
    expect(conversion).toContain('dynamic sampling (level=2)');
  });

  it.each(Object.entries(plans))('%s da el mismo análisis con los valores ocultos', (_name, plan) => {
    const summary = (input: string) => {
      const analysis = analysisOf(input);
      return {
        verdict: analysis.verdict,
        totalMs: analysis.totalMs,
        nodes: analysis.nodes.map((node) => [node.type, node.selfMs]),
        findings: analysis.findings.map((finding) => [finding.rule, finding.severity, finding.nodeId, finding.sql]),
        notices: analysis.notices.map((notice) => notice.id),
      };
    };
    expect(summary(maskLiterals(plan))).toEqual(summary(plan));
  });
});
