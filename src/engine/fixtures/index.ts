// Planes de prueba. Todos usan tablas inventadas (pedidos, clientes, facturas) o tablas de TPC-H.
// Los de Oracle siguen el texto de DBMS_XPLAN.DISPLAY_CURSOR con 'ALLSTATS LAST +ALIAS'.
import { analyze } from '../index';
import type { Analysis } from '../types';
import control from './control.txt?raw';
import oracleControl from './oracle-control.txt?raw';
import oracleDbeaverPartial from './oracle-dbeaver-partial.txt?raw';
import oracleEstimates from './oracle-estimates.txt?raw';
import oracleFullScan from './oracle-full-scan.txt?raw';
import oracleHashSort from './oracle-hash-sort.txt?raw';
import oracleImplicitConversion from './oracle-implicit-conversion.txt?raw';
import oracleNestedLoop from './oracle-nested-loop.txt?raw';
import oracleNoStats from './oracle-no-stats.txt?raw';
import oracleParallel from './oracle-parallel.txt?raw';
import controlDbeaverText from './control-dbeaver-texto.txt?raw';
import controlPgadmin from './control-pgadmin.txt?raw';
import controlPsql from './control-psql.txt?raw';
import customerStats from './customer-stats.txt?raw';
import dateFilter from './date-filter.txt?raw';
import estimateOnly from './estimate-only.txt?raw';
import hashAggregate from './hash-aggregate.txt?raw';
import hashSort from './hash-sort.txt?raw';
import limit from './limit.txt?raw';
import nestedLoopJson from './nested-loop.json?raw';
import nestedLoop from './nested-loop.txt?raw';
import parallel from './parallel.txt?raw';
import resultDominant from './result-dominante.txt?raw';
import seqScan from './seq-scan.txt?raw';
import subplans from './subplans.txt?raw';
import summarySections from './summary-sections.txt?raw';

export const plans = {
  control,
  controlDbeaverText,
  controlPgadmin,
  controlPsql,
  customerStats,
  dateFilter,
  estimateOnly,
  hashAggregate,
  hashSort,
  limit,
  nestedLoop,
  nestedLoopJson,
  parallel,
  resultDominant,
  seqScan,
  subplans,
  summarySections,
  oracleControl,
  oracleDbeaverPartial,
  oracleEstimates,
  oracleFullScan,
  oracleHashSort,
  oracleImplicitConversion,
  oracleNestedLoop,
  oracleNoStats,
  oracleParallel,
};

/** Analiza y falla la prueba si el plan no se pudo leer */
export function analysisOf(input: string): Analysis {
  const result = analyze(input);
  if (!result.ok) throw new Error(`No se pudo leer el plan: ${result.error}`);
  return result.analysis;
}

/** Hallazgos de una regla */
export const findingsOf = (analysis: Analysis, rule: Analysis['findings'][number]['rule']) =>
  analysis.findings.filter((finding) => finding.rule === rule);
