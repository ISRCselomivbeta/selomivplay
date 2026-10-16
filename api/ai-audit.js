/**
 * /api/ai-audit.js
 * 
 * Recebe dados públicos + (opcional) financeiro, retorna:
 *   - confirmed: receita reportada pelo titular (nunca somada com estimativa)
 *   - estimates: faixa de projeção por cenário (conservador/moderado/otimista)
 *   - findings: recomendações
 * 
 * Regra central: view é audiência. Receita é dinheiro. Nunca são a mesma coisa.
 */

const RPM_SCENARIOS = {
  conservador: 0.0002,
  moderado: 0.0008,
  otimista: 0.0025
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { publicData, financialData } = req.body || {};

  if (!publicData || typeof publicData.views !== 'number') {
    return res.status(400).json({ error: 'publicData.views é obrigatório' });
  }

  const views = publicData.views;
  const confirmed = financialData && typeof financialData.net === 'number'
    ? {
        gross: financialData.gross ?? null,
        net: financialData.net,
        source: financialData.source || 'relatório do titular',
        note: 'Valor reportado. Não é estimativa.'
      }
    : null;

  const estimates = {
    note: 'Estimativa baseada em faixa de RPM. Não é receita confirmada.',
    scenarios: [
      {
        label: 'Conservador',
        rpm: RPM_SCENARIOS.conservador,
        value: round2(views * RPM_SCENARIOS.conservador)
      },
      {
        label: 'Moderado',
        rpm: RPM_SCENARIOS.moderado,
        value: round2(views * RPM_SCENARIOS.moderado)
      },
      {
        label: 'Otimista',
        rpm: RPM_SCENARIOS.otimista,
        value: round2(views * RPM_SCENARIOS.otimista)
      }
    ]
  };

  const findings = buildFindings(views, confirmed, estimates);

  res.setHeader('Cache-Control', 's-maxage=600');
  return res.status(200).json({ confirmed, estimates, findings });
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function buildFindings(views, confirmed, estimates) {
  const out = [];

  if (!confirmed) {
    out.push({
      severity: 'info',
      issue: 'Sem receita confirmada',
      recommendation: 'Forneça um relatório da distribuidora para ver valores reais. As estimativas acima são simulação.'
    });
  } else {
    const net = confirmed.net;
    const moderado = estimates.scenarios[1].value;
    const ratio = net / moderado;

    if (ratio < 0.5) {
      out.push({
        severity: 'warning',
        issue: 'Receita confirmada abaixo da faixa estimada',
        recommendation: 'Verifique ISRC, registro no ECAD e metadados. Pode haver royalties não atribuídos.'
      });
    } else if (ratio > 2) {
      out.push({
        severity: 'info',
        issue: 'Receita confirmada acima da faixa estimada',
        recommendation: 'Bom desempenho. Considere documentar o que funcionou para replicar.'
      });
    }
  }

  if (views < 1000) {
    out.push({
      severity: 'info',
      issue: 'Base de audiência pequena',
      recommendation: 'Foque em crescimento antes de analisar receita. Volume baixo distorce qualquer projeção.'
    });
  }

  return out;
}
