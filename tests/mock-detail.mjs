const real=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 if(String(url)==='https://api.openai.com/v1/responses'){
  const value={products:[{name:'온유 티 500mL',title:'온유 티와 잠깐의 휴식',description:'상품 상세페이지에 기재된 온유 티의 특징을 소개합니다.',audience:'차를 즐기는 사람 · AI 제안',cta:'한 잔의 휴식',claims:[{text:'용량 500mL',status:'source',sources:[1]},{text:'효능 문구 확인 필요',status:'review',sources:[1]}]},{name:'온유 티 1L',title:'큰 병 온유 티',description:'별도 옵션입니다. 다른 옵션과 혼합하지 않습니다.',audience:'가족',cta:'함께 즐겨요',claims:[{text:'용량 1L',status:'source',sources:[1]}]}],warnings:['효능 문구는 원본과 광고 사용 적절성을 확인해 주세요.']};
  return new Response(JSON.stringify({id:'mock-detail',status:'completed',usage:{input_tokens:500,output_tokens:500},output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]}),{status:200});
 }
 return real(url,options);
};
