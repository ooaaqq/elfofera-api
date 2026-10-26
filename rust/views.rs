use crate::model::*;
use chrono::NaiveDate;
use schemars::JsonSchema;
use serde::Serialize;
use serde_json::Value;

pub fn source_urls<T: Serialize>(row: &T) -> anyhow::Result<Vec<String>> {
    fn visit(value: &Value, urls: &mut Vec<String>) {
        match value {
            Value::Array(values) => {
                for v in values {
                    visit(v, urls)
                }
            }
            Value::Object(fields) => {
                for (key, child) in fields {
                    let url = child.as_str().and_then(|s| {
                        if matches!(key.as_str(), "bvid" | "locator" | "preferredRecordingBvid")
                            && s.starts_with("BV")
                            && s[2..]
                                .chars()
                                .all(|c| c.is_ascii_alphanumeric() || c == '_')
                        {
                            Some(format!("https://www.bilibili.com/video/{s}"))
                        } else if matches!(key.as_str(), "dynamicId" | "announcementId")
                            && !s.is_empty()
                            && s.bytes().all(|b| b.is_ascii_digit())
                        {
                            Some(format!("https://t.bilibili.com/{s}"))
                        } else if key == "url"
                            && (s.starts_with("https://") || s.starts_with("http://"))
                        {
                            Some(s.to_owned())
                        } else {
                            None
                        }
                    });
                    if let Some(url) = url
                        && !urls.contains(&url)
                    {
                        urls.push(url)
                    }
                    visit(child, urls);
                }
            }
            _ => {}
        }
    }
    let mut urls = Vec::new();
    visit(&serde_json::to_value(row)?, &mut urls);
    Ok(urls)
}
#[derive(Debug, Clone, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct WorkView {
    pub id: String,
    pub title: String,
    pub original_artists: Vec<String>,
    pub source_urls: Vec<String>,
}
impl From<&Work> for WorkView {
    fn from(w: &Work) -> Self {
        Self {
            id: w.id.clone(),
            title: w.title.clone(),
            original_artists: w.original_artists.clone(),
            source_urls: w.source_urls.clone(),
        }
    }
}
#[derive(Debug, Clone, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct EventView {
    pub id: String,
    pub date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub title: String,
    pub kind: String,
    pub occurrence: String,
    pub recording_named_members: Vec<Member>,
    pub planned_members: Vec<Member>,
    pub host_member: Option<Member>,
    pub guests: Vec<Guest>,
    pub stages: Vec<Stage>,
    pub content_type: Option<String>,
    pub series: Option<String>,
    pub dimension: Option<String>,
    pub is_unannounced: Option<bool>,
    pub source_urls: Vec<String>,
}
impl From<&Event> for EventView {
    fn from(e: &Event) -> Self {
        Self {
            id: e.id.clone(),
            date: e.date,
            end_date: e.end_date,
            title: e.title.clone(),
            kind: e.kind.clone(),
            occurrence: e.occurrence.clone(),
            recording_named_members: e.recording_named_members.clone(),
            planned_members: e.planned_members.clone(),
            host_member: e.host_member,
            guests: e.guests.clone(),
            stages: e.stages.clone(),
            content_type: e.content_type.clone(),
            series: e.series.clone(),
            dimension: e.dimension.clone(),
            is_unannounced: e.is_unannounced,
            source_urls: e.source_urls.clone(),
        }
    }
}
#[derive(Debug, Clone, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceView {
    pub id: String,
    pub date: NaiveDate,
    pub event_id: String,
    pub work_id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub credited_members: Vec<Member>,
    pub credited_group: Option<String>,
    pub source_urls: Vec<String>,
}
impl From<&Performance> for PerformanceView {
    fn from(p: &Performance) -> Self {
        Self {
            id: p.id.clone(),
            date: p.date,
            event_id: p.event_id.clone(),
            work_id: p.work_id.clone(),
            kind: p.kind.clone(),
            credited_members: p.credited_members.clone(),
            credited_group: p.credited_group.clone(),
            source_urls: p.source_urls.clone(),
        }
    }
}
#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RecordingView {
    pub bvid: String,
    pub date: NaiveDate,
    pub event_ids: Vec<String>,
    pub title: String,
    pub uploader_name: Option<String>,
    pub url: String,
}
#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PlanView {
    pub id: String,
    pub date: NaiveDate,
    pub rest_day: Option<bool>,
    pub events: Vec<PlanEvent>,
    pub non_stream_activities: Vec<String>,
    pub source_urls: Vec<String>,
}
#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ChangeView {
    pub id: String,
    pub date: NaiveDate,
    pub action: String,
    pub title: Option<String>,
    pub members: Vec<String>,
    pub from: Option<ChangeSlot>,
    pub to: Option<ChangeSlot>,
    pub event_id: Option<String>,
    pub source_urls: Vec<String>,
}
#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub total: usize,
    pub limit: usize,
    pub offset: usize,
    pub has_more: bool,
    pub completeness: Completeness,
}
#[derive(Debug, Serialize, JsonSchema)]
pub enum Completeness {
    #[serde(rename = "known-records")]
    KnownRecords,
}
impl Page {
    pub fn new(total: usize, limit: usize, offset: usize, length: usize) -> Self {
        Self {
            total,
            limit,
            offset,
            has_more: offset + length < total,
            completeness: Completeness::KnownRecords,
        }
    }
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct SearchResponse {
    pub items: Vec<WorkView>,
    #[serde(flatten)]
    pub page: Page,
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct HistoryItem {
    #[serde(flatten)]
    pub performance: PerformanceView,
    pub event: EventView,
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct HistoryResponse {
    pub work: WorkView,
    pub items: Vec<HistoryItem>,
    #[serde(flatten)]
    pub page: Page,
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct Range {
    pub from: Option<NaiveDate>,
    pub through: Option<NaiveDate>,
}
#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct MemberCount {
    pub member: Member,
    pub count: usize,
    pub source_urls: Vec<String>,
}
#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct StatisticsResponse {
    pub work: WorkView,
    pub range: Range,
    pub counting_unit: CountingUnit,
    pub completeness: Completeness,
    pub total: usize,
    pub uncredited: usize,
    pub by_member: Vec<MemberCount>,
}
#[derive(Debug, Serialize, JsonSchema)]
pub enum CountingUnit {
    #[serde(rename = "performance-record")]
    PerformanceRecord,
}
#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct TimelinePerformance {
    #[serde(flatten)]
    pub performance: PerformanceView,
    pub work: WorkView,
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct TimelineEvent {
    #[serde(flatten)]
    pub event: EventView,
    pub performances: Vec<TimelinePerformance>,
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct Day {
    pub date: NaiveDate,
    pub events: Vec<TimelineEvent>,
    pub performances: Vec<TimelinePerformance>,
    pub plans: Vec<PlanView>,
    pub recordings: Vec<RecordingView>,
    pub changes: Vec<ChangeView>,
}
#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct TimelineResponse {
    pub range: Range,
    pub time_zone: TimeZone,
    pub completeness: Completeness,
    pub included: Vec<String>,
    pub days: Vec<Day>,
}
#[derive(Debug, Serialize, JsonSchema)]
pub enum TimeZone {
    #[serde(rename = "Asia/Shanghai")]
    Shanghai,
}
