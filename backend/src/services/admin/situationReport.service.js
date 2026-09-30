const { getOpenAIClient } = require('../../config/openai');
const env = require('../../config/env');
const promptService = require('../ai/prompt.service');
const { validateSituationReportResponse } = require('../ai/aiResponseParser');
const analyticsService = require('../analytics/analytics.service');
const hotspotService = require('../complaint/hotspot.service');
const situationReportModel = require('../../models/situationReport.model');
const logger = require('../../utils/logger');

/**
 * Assembles ONLY verified aggregated numbers (Section 11) - never raw complaint text or
 * citizen PII - for the AI to summarize. This snapshot is also stored verbatim alongside
 * the generated text so admins can always see exactly what data the summary was based on.
 */
async function buildStatsSnapshot() {
  const [summary, byCategory, byDepartment, slaBreaches, hotspots] = await Promise.all([
    analyticsService.getSummaryStats(),
    analyticsService.getByCategory(),
    analyticsService.getByDepartment(),
    analyticsService.getSlaBreaches(10),
    hotspotService.detectHotspots(),
  ]);

  return {
    generated_at: new Date().toISOString(),
    total_complaints: Number(summary.total),
    critical_complaints: Number(summary.critical_count),
    high_priority_complaints: Number(summary.high_priority_count),
    sla_breaches: Number(summary.sla_breaches),
    needs_review: Number(summary.needs_review),
    resolved: Number(summary.resolved),
    in_progress: Number(summary.in_progress),
    by_category: byCategory.map((c) => ({ category: c.category, count: Number(c.count) })),
    by_department: byDepartment.map((d) => ({ department: d.department, count: Number(d.count) })),
    sla_breach_examples: slaBreaches.slice(0, 5).map((c) => ({
      complaint_number: c.complaint_number,
      category: c.category,
      department: c.department_name,
    })),
    hotspots: hotspots.slice(0, 5).map((h) => ({
      category: h.category,
      complaint_count: h.complaintCount,
      radius_meters: h.radiusMeters,
      dominant_priority: h.dominantPriority,
    })),
  };
}

async function generateSituationReport(generatedByUserId) {
  const statsSnapshot = await buildStatsSnapshot();

  const client = getOpenAIClient();
  if (!client) {
    return { success: false, failureReason: 'OPENAI_API_KEY not configured.', statsSnapshot };
  }

  try {
    const completion = await client.chat.completions.create({
      useCase: 'situation_report',
      model: env.openai.textModel,
      messages: [
        { role: 'system', content: promptService.buildSituationReportSystemPrompt() },
        { role: 'user', content: promptService.buildSituationReportUserContent(statsSnapshot) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 600,
    });

    const rawText = completion.choices[0]?.message?.content || '';
    const validated = validateSituationReportResponse(rawText);
    if (!validated.success) {
      return { success: false, failureReason: 'AI returned an unexpected response format.', statsSnapshot };
    }

    const report = await situationReportModel.create({
      generatedBy: generatedByUserId,
      summary: JSON.stringify(validated.data),
      statsSnapshot,
    });

    logger.info('AI situation report generated.', { reportId: report.id, generatedByUserId });

    return { success: true, report, content: validated.data, statsSnapshot };
  } catch (err) {
    logger.warn('Situation report generation failed.', { error: err.message });
    return { success: false, failureReason: err.message, statsSnapshot };
  }
}

module.exports = { buildStatsSnapshot, generateSituationReport };
