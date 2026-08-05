import { portalCopy } from '../content/portal-copy';

export function RoleDashboard() {
  return (
    <div className="dashboardGrid">
      {portalCopy.metrics.map((metric) => (
        <article className="metricCard" key={metric.label}>
          <p className="metricValue">{metric.value}</p>
          <p className="metricLabel">{metric.label}</p>
        </article>
      ))}

      <section className="queueSection" aria-label={portalCopy.queueLabel}>
        {portalCopy.queues.map((queue) => (
          <article className="queueCard" key={queue.title}>
            <div>
              <h3>{queue.title}</h3>
              <p className="queueMeta">{queue.meta}</p>
            </div>
            <button className="queueAction" type="button">
              {queue.action}
            </button>
          </article>
        ))}
      </section>

      <aside className="rolePanel">
        <h3>{portalCopy.rolePanelTitle}</h3>
        <p className="roleDescription">{portalCopy.rolePanelDescription}</p>
        <ul className="roleList">
          {portalCopy.roleResponsibilities.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
