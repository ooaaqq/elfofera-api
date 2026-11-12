use crate::model::*;
use chrono::NaiveDate;
use schemars::JsonSchema;
use serde::Serialize;

pub fn source_urls(sources: &[Source]) -> Vec<String> {
    sources.iter().map(|source| source.url.clone()).collect()
}
#[derive(Debug, Clone, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct WorkView {
    pub id: String,
    pub title: String,
    pub original_artists: Vec<String>,
    pub aliases: Vec<String>,
    pub kind: Option<WorkKind>,
    pub series: Option<String>,
    pub source_urls: Vec<String>,
}
impl From<&Work> for WorkView {
    fn from(w: &Work) -> Self {
        Self {
            id: w.id.clone(),
            title: w.title.clone(),
            original_artists: w.original_artists.clone(),
            aliases: w.aliases.clone(),
            kind: w.kind,
            series: w.series.clone(),
            source_urls: source_urls(&w.sources),
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
    pub kind: EventKind,
    pub basis: EvidenceBasis,
    pub recording_named_members: Vec<Member>,
    pub planned_members: Vec<Member>,
    pub credited_members: Vec<Member>,
    pub announced_members: Vec<Member>,
    pub absent_members: Vec<Member>,
    pub credited_performers: Vec<String>,
    pub credited_group: Option<String>,
    pub relations: Vec<EventRelation>,
    pub plan_ids: Vec<String>,
    pub text: Option<String>,
    pub notes: Vec<String>,
    pub host_member: Option<Member>,
    pub guests: Vec<Guest>,
    pub stages: Vec<Stage>,
    pub title_hours: Vec<u8>,
    pub recordings: Vec<Asset>,
    pub preferred_recording_bvid: Option<Bvid>,
    pub content_type: Option<ContentType>,
    pub series: Option<String>,
    pub dimension: Option<Dimension>,
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
            kind: e.kind,
            basis: e.basis,
            recording_named_members: e.recording_named_members.clone(),
            planned_members: e.planned_members.clone(),
            credited_members: e.credited_members.clone(),
            announced_members: e.announced_members.clone(),
            absent_members: e.absent_members.clone(),
            credited_performers: e.credited_performers.clone(),
            credited_group: e.credited_group.clone(),
            relations: e.relations.clone(),
            plan_ids: e.plan_ids.clone(),
            text: e.text.clone(),
            notes: e.notes.clone(),
            host_member: e.host_member,
            guests: e.guests.clone(),
            stages: e.stages.clone(),
            title_hours: e.title_hours.clone(),
            recordings: e.recordings.clone(),
            preferred_recording_bvid: e.preferred_recording_bvid.clone(),
            content_type: e.content_type,
            series: e.series.clone(),
            dimension: e.dimension,
            is_unannounced: e.is_unannounced,
            source_urls: source_urls(&e.sources),
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
    pub kind: PerformanceKind,
    pub credited_members: Vec<Member>,
    pub credited_group: Option<String>,
    pub credited_performers: Vec<String>,
    pub member_roles: Vec<MemberRole>,
    pub stage_name: Option<String>,
    pub instrument: Option<String>,
    pub reference_artist: Option<String>,
    pub assets: Vec<Asset>,
    pub notes: Vec<String>,
    pub source_urls: Vec<String>,
}
impl From<&Performance> for PerformanceView {
    fn from(p: &Performance) -> Self {
        Self {
            id: p.id.clone(),
            date: p.date,
            event_id: p.event_id.clone(),
            work_id: p.work_id.clone(),
            kind: p.kind,
            credited_members: p.credited_members.clone(),
            credited_group: p.credited_group.clone(),
            credited_performers: p.credited_performers.clone(),
            member_roles: p.member_roles.clone(),
            stage_name: p.stage_name.clone(),
            instrument: p.instrument.clone(),
            reference_artist: p.reference_artist.clone(),
            assets: p.assets.clone(),
            notes: p.notes.clone(),
            source_urls: source_urls(&p.sources),
        }
    }
}
#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum RecordingDateBasis {
    Event,
    Title,
}
#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RecordingView {
    pub bvid: Bvid,
    pub title_session: TitleSession,
    pub date_basis: RecordingDateBasis,
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
    pub entries: Vec<PlanEntry>,
    pub non_stream_activities: Vec<String>,
    pub source_urls: Vec<String>,
}

#[derive(Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ChangeView {
    pub date: NaiveDate,
    #[serde(flatten)]
    pub change: Change,
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
