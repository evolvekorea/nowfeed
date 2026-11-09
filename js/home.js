(() => {
  const grid=document.querySelector('#story-grid');
  const latest=document.querySelector('#latest-stories');
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
  function storyImage(post, loading='lazy') {
    const image=element('img','');
    image.src='/images/og-'+post.id+'.png';
    image.alt='';
    image.loading=loading;
    image.addEventListener('error',()=>{image.hidden=true;});
    return image;
  }

  function latestCard(post, index) {
    const card=element('article','','hot-card');
    const link=element('a','');
    link.href='/'+post.url;

    const cover=element('div','','cover');
    cover.append(storyImage(post,index===0?'eager':'lazy'));

    const meta=element('div','','latest-meta');
    const date=element('time',post.publishedAt.slice(0,10).replaceAll('-','.'));
    date.dateTime=post.publishedAt;
    meta.append(element('span',topic(post),'tag'),date);

    const copy=element('div','','hot-copy');
    const read=element('span','사연 읽고 투표하기 ','read');
    const arrow=element('b','↗');
    arrow.setAttribute('aria-hidden','true');
    read.append(arrow);
    copy.append(meta,element('h3',post.title),element('p',post.summary||''),read);
    link.append(cover,copy);
    card.append(link);
    return card;
  }

  function storyCard(post) {
    const a=element('a','','story');a.href='/'+post.url;a.dataset.topic=topic(post);a.dataset.summary=post.summary||'';
    const body=element('div','');
    const date=element('small',post.publishedAt.slice(0,10).replaceAll('-','.'));
    date.append(element('span','사연 읽기 ↗'));
    body.append(element('span',topic(post),'tag'),element('h3',post.title),date);
    a.append(body,storyImage(post));return a;
  }
  // Both story sections keep their server-rendered links if fetching fails.
  async function refreshStories() {
    try{
      const response=await fetch('/data/posts.json',{cache:'no-cache',signal:AbortSignal.timeout(10_000)});
      if(!response.ok)throw new Error('Posts unavailable');
      const data=await response.json();
      if(!Array.isArray(data))return;
      const posts=data.filter(p=>p&&typeof p.id==='string'&&/^[a-z0-9-]+$/.test(p.id)&&!p.id.endsWith('-preview')&&typeof p.url==='string'&&/^articles\/[a-zA-Z0-9/_-]+\/$/.test(p.url)&&typeof p.title==='string'&&typeof p.publishedAt==='string'&&Number.isFinite(Date.parse(p.publishedAt)))
        .sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
      if(!posts.length)return;
      latest?.replaceChildren(...posts.slice(0,3).map(latestCard));
      grid.replaceChildren(...posts.map(storyCard));
      filter();
    }catch{/* Preserve the server-rendered stories. */}
  }
  refreshStories();
})();
