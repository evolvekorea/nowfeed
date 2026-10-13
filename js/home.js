(() => {
  const grid=document.querySelector('#story-grid');
  if(!grid)return;
  const search=document.querySelector('#search');
  let category='전체';
  const topic=p=>p.category?.startsWith('연애')?'연애':p.category?.startsWith('결혼')?'결혼·가족':'일상·고민';
  function filter() {
    const q=search.value.trim().toLowerCase();
    let count=0;
    [...grid.children].forEach(card=>{
      const match=(category==='전체'||card.dataset.topic===category)&&`${card.textContent} ${card.dataset.summary}`.toLowerCase().includes(q);
      card.hidden=!match;if(match)count++;
    });
    document.querySelector('#count').textContent=count;
    document.querySelector('#empty').hidden=count>0;
    document.querySelector('.list-end').hidden=category!=='전체'||!!q;
  }
  search.addEventListener('input',filter);
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
    category=button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(other=>{other.classList.toggle('selected',other===button);other.setAttribute('aria-pressed',String(other===button));});
    filter();
  }));
  const element=(tag,text,className)=>{const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;};
  function storyCard(post) {
    const a=element('a','','story');a.href='/'+post.url;a.dataset.topic=topic(post);a.dataset.summary=post.summary||'';
    const body=element('div','');
    const date=element('small',post.publishedAt.slice(0,10).replaceAll('-','.'));
    date.append(element('span','사연 읽기 ↗'));
    body.append(element('span',topic(post),'tag'),element('h3',post.title),date);
    const image=element('img','');image.src=`/images/og-${post.id}.png`;image.alt='';image.loading='lazy';image.addEventListener('error',()=>{image.hidden=true;});
    a.append(body,image);return a;
  }
  // Keep the complete HTML list usable if the request or JavaScript fails.
  async function refreshStories() {
    try{
      const response=await fetch('/data/posts.json',{cache:'no-cache',signal:AbortSignal.timeout(10_000)});
      if(!response.ok)throw new Error('Posts unavailable');
      const data=await response.json();
      if(!Array.isArray(data))return;
      const posts=data.filter(p=>typeof p.id==='string'&&/^[a-z0-9-]+$/.test(p.id)&&!p.id.endsWith('-preview')&&typeof p.url==='string'&&/^articles\/[a-zA-Z0-9/_-]+\/$/.test(p.url)&&typeof p.title==='string'&&typeof p.publishedAt==='string').sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
      if(!posts.length)return;
      grid.replaceChildren(...posts.map(storyCard));filter();
    }catch{/* Preserve the server-rendered stories. */}
  }
  refreshStories();
})();
