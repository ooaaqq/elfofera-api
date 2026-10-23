/** Export the four supported tools from the same Zod inputs as HTTP routes. */
import { z } from "zod";
import {
  historyRoute,
  statisticsRoute,
  timelineRoute,
  worksRoute,
} from "./routes.js";

const rules =
  "资料仅覆盖已确认记录，空结果不能证明从未发生。回答保留来源或录播链接，区分计划与实际，不能把上传者当成演唱者。未知原唱与不使用的筛选填 null，不猜测。";
export function toolCatalog() {
  const operations = [
    {
      name: "elfofera_timeline",
      route: timelineRoute,
      description:
        "查询日期范围的活动、计划、变更、录播和表演。相对日期按 Asia/Shanghai 计算。全体成员一次查询；问歌单时包含 performances。",
    },
    {
      name: "elfofera_search_works",
      route: worksRoute,
      description:
        "按歌名或原唱搜索作品。未明确原唱填 artist=null；先搜索获取真实 workId，同名作品先核对原唱和来源。",
    },
    {
      name: "elfofera_work_history",
      route: historyRoute,
      description:
        "查询作品的表演明细。先搜索获取 workId，读取 total 和 hasMore，完整明细需要翻完页。问次数使用统计工具。",
    },
    {
      name: "elfofera_work_statistics",
      route: statisticsRoute,
      description:
        "查询作品总表演次数及五位成员署名次数，一次返回所有成员。合唱计入各署名成员，成员次数之和不是总表演数。",
    },
  ];
  return operations.map(({ name, route, description }) => {
    const shape = route.request.query.shape;
    const properties: Record<string, unknown> = {};
    for (const [key, schema] of Object.entries(shape)) {
      // HTTP query strings coerce numbers; tool calls use native JSON numbers.
      const field = schema.isOptional() ? schema.unwrap().nullable() : schema;
      properties[key] = z.toJSONSchema(field, {
        io: "output",
        unrepresentable: "any",
      });
    }
    const pathParameters =
      "params" in route.request ? Object.keys(route.request.params.shape) : [];
    if ("params" in route.request)
      for (const [key, schema] of Object.entries(route.request.params.shape))
        properties[key] = z.toJSONSchema(schema, {
          io: "output",
          unrepresentable: "any",
        });
    return {
      name,
      description: description + rules,
      path: route.path,
      pathParameters,
      parameters: {
        type: "object",
        properties,
        required: Object.keys(properties),
        additionalProperties: false,
      },
    };
  });
}
