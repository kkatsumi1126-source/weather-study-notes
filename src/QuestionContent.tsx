import type { Question } from './question';
export function QuestionContent({question:q}:{question:Question}) {
  const explanationKeys = (['where','read','judge','caution'] as const).filter(key=>q.explanation[key]?.trim());
  const titles={where:'どこを見るか',read:'何を読み取るか',judge:'どう判断するか',caution:'注意点'};
  return <>
    <section><h4>回答</h4><p className="answer-text">{q.answer}</p></section>
    {(q.originalExplanation?.trim() || explanationKeys.length>0) && <section><h4>解説</h4>
      {q.originalExplanation?.trim() && <p className="original-explanation">{q.originalExplanation}</p>}
      {explanationKeys.length>0 && <ol className="explanations">{explanationKeys.map(key=><li key={key}><strong>{titles[key]}</strong><p>{q.explanation[key]}</p></li>)}</ol>}
    </section>}
    {q.memorize?.trim() && <aside className="memorize"><h4>ここで暗記</h4><p>{q.memorize}</p></aside>}
  </>;
}
