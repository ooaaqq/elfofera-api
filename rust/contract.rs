use crate::{data::normalize, model::Member, views::*};
use anyhow::{Context, Result, ensure};
use chrono::NaiveDate;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use serde_json::{Value, json};
use std::collections::HashSet;

fn default_limit() -> usize {
    20
}
fn default_include() -> String {
    "events,plans,recordings,changes".to_owned()
}
#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct SearchQuery {
    #[schemars(length(min = 1, max = 200))]
    pub q: Option<String>,
    #[schemars(length(min = 1, max = 200))]
    pub artist: Option<String>,
    #[serde(default = "default_limit")]
    #[schemars(range(min = 1, max = 100))]
    pub limit: usize,
    #[serde(default)]
    #[schemars(range(max = 100000))]
    pub offset: usize,
}
#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct HistoryQuery {
    pub from: Option<NaiveDate>,
    pub through: Option<NaiveDate>,
    pub member: Option<Member>,
    #[serde(default = "default_limit")]
    #[schemars(range(min = 1, max = 100))]
    pub limit: usize,
    #[serde(default)]
    #[schemars(range(max = 100000))]
    pub offset: usize,
}
#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct StatisticsQuery {
    pub from: Option<NaiveDate>,
    pub through: Option<NaiveDate>,
}
#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct TimelineQuery {
    pub from: NaiveDate,
    pub through: NaiveDate,
    pub member: Option<Member>,
    #[serde(default = "default_include")]
    pub include: String,
}
#[derive(Debug, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WorkPath {
    #[schemars(length(min = 1, max = 200))]
    pub work_id: String,
}
trait Validate {
    fn validate(&self) -> Result<()>;
}
impl Validate for SearchQuery {
    fn validate(&self) -> Result<()> {
        for text in [&self.q, &self.artist].into_iter().flatten() {
            ensure!(
                !normalize(text.trim()).is_empty(),
                "search must contain letters or numbers"
            );
        }
        Ok(())
    }
}
fn ordered(from: Option<NaiveDate>, through: Option<NaiveDate>) -> Result<()> {
    ensure!(
        from.zip(through).is_none_or(|(a, b)| a <= b),
        "from must precede through"
    );
    Ok(())
}
impl Validate for HistoryQuery {
    fn validate(&self) -> Result<()> {
        ordered(self.from, self.through)
    }
}
impl Validate for StatisticsQuery {
    fn validate(&self) -> Result<()> {
        ordered(self.from, self.through)
    }
}
impl Validate for TimelineQuery {
    fn validate(&self) -> Result<()> {
        ensure!(
            (0..31).contains(&(self.through - self.from).num_days()),
            "use an ordered range of at most 31 days"
        );
        let categories = self.include.split(',').collect::<Vec<_>>();
        ensure!(
            categories
                .iter()
                .all(|s| ["events", "plans", "performances", "recordings", "changes"].contains(s))
                && categories.iter().collect::<HashSet<_>>().len() == categories.len(),
            "include must contain distinct supported categories"
        );
        Ok(())
    }
}
#[derive(Clone, Copy)]
pub enum Operation {
    Timeline,
    Search,
    History,
    Statistics,
}
pub struct Definition {
    pub operation: Operation,
    pub path: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub schema: Value,
    pub response: Value,
    pub validator: jsonschema::Validator,
}
fn schema<T: JsonSchema>() -> Value {
    let schema = schemars::schema_for!(T).to_value();
    fn inline(value: &Value, root: &Value) -> Value {
        if let Some(reference) = value
            .get("$ref")
            .and_then(Value::as_str)
            .and_then(|s| s.strip_prefix('#'))
            && let Some(target) = root.pointer(reference)
        {
            return inline(target, root);
        }
        match value {
            Value::Array(values) => Value::Array(values.iter().map(|v| inline(v, root)).collect()),
            Value::Object(fields) => Value::Object(
                fields
                    .iter()
                    .filter(|(k, _)| !matches!(k.as_str(), "$schema" | "$defs" | "title"))
                    .map(|(k, v)| (k.clone(), inline(v, root)))
                    .collect(),
            ),
            value => value.clone(),
        }
    }
    inline(&schema, &schema)
}
impl Definition {
    fn new<Q: JsonSchema, R: JsonSchema>(
        operation: Operation,
        path: &'static str,
        name: &'static str,
        description: &'static str,
    ) -> Result<Self> {
        let query_schema = schema::<Q>();
        let validator = jsonschema::options()
            .should_validate_formats(true)
            .build(&query_schema)?;
        Ok(Self {
            operation,
            path,
            name,
            description,
            schema: query_schema,
            response: schema::<R>(),
            validator,
        })
    }
    pub fn parse(&self, query: Option<&str>) -> Result<Input> {
        let mut object = serde_json::Map::new();
        for (key, value) in url::form_urlencoded::parse(query.unwrap_or("").as_bytes()) {
            ensure!(
                !object.contains_key(key.as_ref()),
                "duplicate query parameter {key}"
            );
            let schema = &self.schema["properties"][key.as_ref()];
            let integer = schema["type"] == "integer";
            let value = if integer {
                json!(
                    value
                        .parse::<u64>()
                        .context("expected nonnegative integer")?
                )
            } else {
                json!(value.trim())
            };
            object.insert(key.into_owned(), value);
        }
        let value = Value::Object(object);
        self.validator
            .validate(&value)
            .map_err(|e| anyhow::anyhow!(e.to_string()))?;
        fn parsed<T: DeserializeOwned + Validate>(v: Value) -> Result<T> {
            let input: T = serde_json::from_value(v)?;
            input.validate()?;
            Ok(input)
        }
        Ok(match self.operation {
            Operation::Timeline => Input::Timeline(parsed(value)?),
            Operation::Search => Input::Search(parsed(value)?),
            Operation::History => Input::History(parsed(value)?),
            Operation::Statistics => Input::Statistics(parsed(value)?),
        })
    }
}
pub enum Input {
    Timeline(TimelineQuery),
    Search(SearchQuery),
    History(HistoryQuery),
    Statistics(StatisticsQuery),
}
pub struct Contract {
    pub definitions: Vec<Definition>,
    pub openapi: Value,
    pub tools: Value,
    pub work_path: jsonschema::Validator,
}
impl Contract {
    pub fn new() -> Result<Self> {
        let definitions = vec![
            Definition::new::<TimelineQuery, TimelineResponse>(
                Operation::Timeline,
                "/v1/timeline",
                "elfofera_timeline",
                "查询日期范围的活动、计划、变更、录播和表演。相对日期按 Asia/Shanghai 计算。全体成员一次查询；问歌单时包含 performances。",
            )?,
            Definition::new::<SearchQuery, SearchResponse>(
                Operation::Search,
                "/v1/works",
                "elfofera_search_works",
                "按歌名或原唱搜索作品。未明确原唱填 artist=null；先搜索获取真实 workId，同名作品先核对原唱和来源。",
            )?,
            Definition::new::<HistoryQuery, HistoryResponse>(
                Operation::History,
                "/v1/works/{workId}/history",
                "elfofera_work_history",
                "查询作品的表演明细。先搜索获取 workId，读取 total 和 hasMore，完整明细需要翻完页。问次数使用统计工具。",
            )?,
            Definition::new::<StatisticsQuery, StatisticsResponse>(
                Operation::Statistics,
                "/v1/works/{workId}/statistics",
                "elfofera_work_statistics",
                "查询作品总表演次数及五位成员署名次数，一次返回所有成员。合唱计入各署名成员，成员次数之和不是总表演数。",
            )?,
        ];
        let path_schema = schema::<WorkPath>();
        let work_path = jsonschema::options().build(&path_schema)?;
        let mut paths = serde_json::Map::new();
        let mut tools = Vec::new();
        for d in &definitions {
            let mut parameters = Vec::new();
            let mut tool_schema = d.schema.clone();
            let required = d.schema["required"].as_array().cloned().unwrap_or_default();
            for (key, field) in d.schema["properties"]
                .as_object()
                .context("query properties")?
            {
                let is_required = required.contains(&json!(key));
                parameters
                    .push(json!({"name":key,"in":"query","required":is_required,"schema":field}));
                if !is_required {
                    tool_schema["properties"][key] = json!({"anyOf":[field,{"type":"null"}]});
                }
            }
            let has_path = d.path.contains("{workId}");
            if has_path {
                let field = &path_schema["properties"]["workId"];
                parameters
                    .push(json!({"name":"workId","in":"path","required":true,"schema":field}));
                tool_schema["properties"]["workId"] = field.clone();
            }
            tool_schema["required"] = json!(
                tool_schema["properties"]
                    .as_object()
                    .context("tool properties")?
                    .keys()
                    .collect::<Vec<_>>()
            );
            tools.push(json!({"name":d.name,"description":format!("{}资料仅覆盖已确认记录，空结果不能证明从未发生。回答保留来源或录播链接，区分计划与实际，不能把上传者当成演唱者。未知原唱与不使用的筛选填 null，不猜测。",d.description),"path":d.path,"pathParameters":if has_path {vec!["workId"]} else {vec![]},"parameters":tool_schema}));
            let mut responses = json!({"200":{"description":"Known confirmed records","content":{"application/json":{"schema":d.response}}},"400":{"description":"Invalid query","content":{"application/json":{"schema":schema::<ErrorBody>()}}}});
            if has_path {
                responses["404"] = json!({"description":"Work not found","content":{"application/json":{"schema":schema::<ErrorBody>()}}});
            }
            paths.insert(d.path.to_owned(),json!({"get":{"operationId":d.name,"summary":d.description,"parameters":parameters,"responses":responses}}));
        }
        paths.insert("/health".to_owned(),json!({"get":{"responses":{"200":{"description":"Validated archive available","content":{"application/json":{"schema":schema::<Health>()}}}}}}));
        Ok(Self {
            definitions,
            openapi: json!({"openapi":"3.1.0","info":{"title":"Elfofera API","version":env!("CARGO_PKG_VERSION")},"paths":paths}),
            tools: json!(tools),
            work_path,
        })
    }
}
#[derive(Serialize, JsonSchema)]
pub struct ErrorBody {
    pub error: String,
}
#[derive(Serialize, JsonSchema)]
pub struct Health {
    pub service: Availability,
}
#[derive(Serialize, JsonSchema)]
pub enum Availability {
    #[serde(rename = "available")]
    Available,
}
