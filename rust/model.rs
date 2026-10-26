use chrono::NaiveDate;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum Member {
    Luzao,
    Youen,
    Yumo,
    Waner,
    Minuo,
}
pub const MEMBERS: [Member; 5] = [
    Member::Luzao,
    Member::Youen,
    Member::Yumo,
    Member::Waner,
    Member::Minuo,
];

impl Member {
    pub fn label(self) -> &'static str {
        match self {
            Self::Luzao => "露早",
            Self::Youen => "柚恩",
            Self::Yumo => "虞莫",
            Self::Waner => "莞儿",
            Self::Minuo => "米诺",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    #[schemars(regex(pattern = r"^BV[0-9A-Za-z]{10}$"))]
    pub bvid: Option<String>,
    pub part_numbers: Option<Vec<std::num::NonZeroU32>>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Guest {
    pub account_id: std::num::NonZeroU64,
    pub name: String,
    pub url: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Stage {
    pub title: String,
    pub dimension: String,
    pub title_hours: Vec<u8>,
    pub recording_bvids: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    #[schemars(length(min = 1))]
    pub id: String,
    pub date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    #[schemars(length(min = 1))]
    pub title: String,
    #[schemars(length(min = 1))]
    pub kind: String,
    #[schemars(length(min = 1))]
    pub occurrence: String,
    #[serde(default)]
    pub recording_named_members: Vec<Member>,
    #[serde(default)]
    pub planned_members: Vec<Member>,
    #[serde(default)]
    pub credited_members: Vec<Member>,
    pub host_member: Option<Member>,
    #[serde(default)]
    pub related_works: Vec<String>,
    #[serde(default)]
    pub recordings: Vec<Asset>,
    #[serde(default)]
    pub assets: Vec<Asset>,
    #[schemars(regex(pattern = r"^BV[0-9A-Za-z]{10}$"))]
    pub preferred_recording_bvid: Option<String>,
    pub content_type: Option<String>,
    pub dimension: Option<String>,
    pub series: Option<String>,
    pub is_unannounced: Option<bool>,
    #[serde(default)]
    pub guests: Vec<Guest>,
    #[serde(default)]
    pub stages: Vec<Stage>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
    #[serde(skip)]
    #[schemars(skip)]
    pub source_urls: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Work {
    #[schemars(length(min = 1))]
    pub id: String,
    #[schemars(length(min = 1))]
    pub title: String,
    #[serde(default)]
    pub original_artists: Vec<String>,
    pub kind: Option<String>,
    pub series: Option<String>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
    #[serde(skip)]
    #[schemars(skip)]
    pub source_urls: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Performance {
    #[schemars(length(min = 1))]
    pub id: String,
    pub date: NaiveDate,
    #[schemars(length(min = 1))]
    pub event_id: String,
    #[schemars(length(min = 1))]
    pub work_id: String,
    #[serde(rename = "type")]
    #[schemars(length(min = 1))]
    pub kind: String,
    #[serde(default)]
    pub credited_members: Vec<Member>,
    pub credited_group: Option<String>,
    pub assets: Vec<Asset>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
    #[serde(skip)]
    #[schemars(skip)]
    pub source_urls: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct TitleSession {
    pub date: NaiveDate,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Uploader {
    pub name: Option<String>,
    pub account_id: Option<std::num::NonZeroU64>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Recording {
    #[schemars(regex(pattern = r"^BV[0-9A-Za-z]{10}$"))]
    pub bvid: String,
    #[schemars(length(min = 1))]
    pub title: String,
    pub title_session: TitleSession,
    pub uploader: Uploader,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PlanEvent {
    #[serde(default)]
    pub members: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub planned_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub participation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host_member: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub room_id: Option<u64>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub date: NaiveDate,
    pub rest_day: Option<bool>,
    #[serde(default)]
    pub events: Vec<PlanEvent>,
    #[serde(default)]
    pub non_stream_activities: Vec<String>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
    #[serde(skip)]
    #[schemars(skip)]
    pub source_urls: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ChangeSlot {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date: Option<NaiveDate>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub planned_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub members: Option<Vec<String>>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Change {
    #[schemars(length(min = 1))]
    pub action: String,
    pub date: Option<NaiveDate>,
    pub title: Option<String>,
    pub member: Option<String>,
    #[serde(default)]
    pub members: Vec<String>,
    pub from: Option<ChangeSlot>,
    pub to: Option<ChangeSlot>,
    pub replaces_plan: Option<ChangeSlot>,
    pub event_id: Option<String>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
    #[serde(skip)]
    #[schemars(skip)]
    pub source_urls: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, Default)]
pub struct Dataset {
    pub events: Vec<Event>,
    pub works: Vec<Work>,
    pub performances: Vec<Performance>,
    pub recordings: Vec<Recording>,
    pub plans: Vec<Plan>,
    pub changes: Vec<Change>,
}
