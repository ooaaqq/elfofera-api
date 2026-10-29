import { ArrowUpRight } from "@carbon/icons-react";
import { Link } from "@carbon/react";
import {
  DocumentationPage,
  DocumentationSection,
} from "./documentation-page.jsx";

const officialAccounts = [
  ["EOE组合", "2018113152"],
  ["露早GOGO", "1669777785"],
  ["柚恩不加糖", "1795147802"],
  ["虞莫MOMO", "1811071010"],
  ["莞儿睡不醒", "1875044092"],
  ["米诺高分少女", "1778026586"],
];

const communityAccounts = [
  ["EOE录播组", "3546645526481422"],
  ["EOE_录播站", "2038114939"],
  ["哎呀米诺录播组", "3461563583302074"],
  ["GOGO队周报", "3493074548296022"],
  ["露早周报", "3546820517038418"],
  ["柚恩周报", "105260060"],
  ["美人虞周报", "1623370968"],
  ["丸不灭", "193161571"],
  ["账号已注销（UID 1498556115）", "1498556115"],
  ["靈轩（已注销）", "2036745631"],
  ["米诺高糖少女", "1017146443"],
];

const technologies = [
  ["React", "https://react.dev/"],
  ["Carbon Design System", "https://carbondesignsystem.com/"],
  ["IBM Plex", "https://www.ibm.com/plex/"],
  ["Sass", "https://sass-lang.com/"],
  ["Rust", "https://www.rust-lang.org/"],
  ["Axum", "https://docs.rs/axum/"],
  ["Tokio", "https://tokio.rs/"],
  ["Serde", "https://serde.rs/"],
  ["JSON Schema", "https://json-schema.org/"],
  ["Bun", "https://bun.com/"],
  ["Vite", "https://vite.dev/"],
  ["TypeScript", "https://www.typescriptlang.org/"],
  ["Biome", "https://biomejs.dev/"],
];

const sections = [
  { id: "thanks-official", title: "官方与成员" },
  { id: "thanks-community", title: "录播与资料整理" },
  { id: "thanks-tools", title: "开源技术" },
];

function Accounts({ accounts }) {
  return (
    <ul className="documentation-accounts">
      {accounts.map(([name, uid]) => (
        <li key={uid}>
          <Link href={`https://space.bilibili.com/${uid}`}>
            {name}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ThanksView({ route, navigate }) {
  return (
    <DocumentationPage
      title="致谢"
      intro="直播、录播与曲目资料的保存，来自成员、录播组和资料整理者的持续分享。感谢每一位让这些记录得以留存的人。"
      sections={sections}
      route={route}
      navigate={navigate}
    >
      <DocumentationSection {...sections[0]}>
        <p>EOE 组合与成员发布的动态、日程和作品，为档案提供了最初的记录。</p>
        <Accounts accounts={officialAccounts} />
      </DocumentationSection>
      <DocumentationSection {...sections[1]}>
        <p>
          以下账号分享的录播、切片和曲目资料，帮助本站补充场次与表演记录。链接指向对应的
          B 站空间。
        </p>
        <Accounts accounts={communityAccounts} />
      </DocumentationSection>
      <DocumentationSection {...sections[2]}>
        <ul className="documentation-technologies">
          {technologies.map(([name, href]) => (
            <li key={name}>
              <Link href={href}>{name}</Link>
            </li>
          ))}
        </ul>
      </DocumentationSection>
    </DocumentationPage>
  );
}
