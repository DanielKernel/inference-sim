import { Link, Navigate, useParams } from "react-router-dom";
import { OVERVIEW_TOPICS, getOverviewTopic } from "../content/overviewTopics";

export function OverviewTopicPage() {
  const { slug } = useParams();
  const topic = getOverviewTopic(slug);

  if (!topic) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="page-stack">
      <section className="hero-panel hero-panel-strong">
        <div>
          <div className="eyebrow">总览专题</div>
          <h2>{topic.title}</h2>
          <p>{topic.summary}</p>
        </div>
        <div className="hero-stats">
          <div className="mini-stat">
            <strong>{topic.sections.length}</strong>
            <span>专题分区</span>
          </div>
          <div className="mini-stat">
            <strong>{topic.sections.reduce((sum, section) => sum + section.items.length, 0)}</strong>
            <span>证据卡片</span>
          </div>
          <div className="mini-stat">
            <strong>{topic.label}</strong>
            <span>当前子菜单</span>
          </div>
        </div>
      </section>

      <section className="toolbar-panel info-band">
        <div className="info-item">
          <strong>引用要求</strong>
          <span>所有结论都绑定真实链接；如来源为 living docs / README，则页面按当前公开内容整理，不补造缺失细节。</span>
        </div>
        <div className="info-item">
          <strong>阅读路径</strong>
          <span>先看结论，再看 takeaways，最后打开 source links 深入原文或仓库。</span>
        </div>
      </section>

      <section className="topic-nav-panel">
        <strong>总览子菜单</strong>
        <div className="topic-pill-row">
          {OVERVIEW_TOPICS.map((item) => (
            <Link
              key={item.slug}
              to={`/overview/${item.slug}`}
              className={`topic-pill ${item.slug === topic.slug ? "active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      {topic.sections.map((section) => (
        <section className="detail-panel" key={section.title}>
          <h3>{section.title}</h3>
          {section.description && <p className="section-description">{section.description}</p>}
          <div className="insight-grid">
            {section.items.map((item) => (
              <article className="insight-card" key={item.title}>
                <h4>{item.title}</h4>
                <p>{item.summary}</p>
                {item.takeaways && item.takeaways.length > 0 && (
                  <div className="insight-takeaways">
                    <strong>落地要点</strong>
                    <ul>
                      {item.takeaways.map((takeaway) => (
                        <li key={takeaway}>{takeaway}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="source-stack">
                  <strong>参考链接</strong>
                  {item.sources.map((source) => (
                    <div className="source-item" key={`${item.title}-${source.url}`}>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.label}
                      </a>
                      {(source.date || source.note) && (
                        <span>
                          {source.date ? `${source.date}` : ""}
                          {source.date && source.note ? " · " : ""}
                          {source.note ? source.note : ""}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
