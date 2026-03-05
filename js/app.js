let clothes = JSON.parse(localStorage.getItem("clothes")) || [];

const addBtn = document.getElementById("addClothBtn");

addBtn.onclick = function(){

const name = document.getElementById("clothName").value;
const tag = document.getElementById("clothTag").value;
const imageFile = document.getElementById("clothImage").files[0];


if(name.trim() === ""){
alert("衣服名称不能为空");
return;
}

if(imageFile){

const reader = new FileReader();

reader.onload = function(e){

const imageData = e.target.result;

addCloth(name,tag,imageData);

}

reader.readAsDataURL(imageFile);

}else{

addCloth(name,tag,null);

}

}


function addCloth(name,tag,image){

    const cloth = {
    name:name,
    tag:tag,
    image:image
    };

    clothes.push(cloth);

    saveClothes();

    renderClothes();

}
function renderClothes(){
    const list = document.getElementById("clothList");
    list.innerHTML = "";
    clothes.forEach((cloth,index)=>{
    const div = document.createElement("div");
    div.className = "cloth-card";
    let imgHTML = "";
    if(cloth.image){
        imgHTML = `<img src="${cloth.image}">`;
    }
    div.innerHTML = `
        ${imgHTML}

        <div class="cloth-name">${cloth.name}</div>
        <span class="tag">${cloth.tag}</span>
        <button class="delete-btn" onclick="deleteCloth(${index})">删除</button>
        `;
    list.appendChild(div);
    });
}

function deleteCloth(index){

    clothes.splice(index,1);

    saveClothes();

    renderClothes();

}

    /* 生成穿搭 */

    const btn = document.getElementById("generateBtn");

    btn.onclick = function(){

    const tops = clothes.filter(c => c.tag === "上衣");
    const pants = clothes.filter(c => c.tag === "裤子");
    const shoes = clothes.filter(c => c.tag === "鞋子");

    const top = randomItem(tops);
    const pant = randomItem(pants);
    const shoe = randomItem(shoes);

    showOutfit("outfitTop","上衣",top);
    showOutfit("outfitPants","裤子",pant);
    showOutfit("outfitShoes","鞋子",shoe);

}

function randomItem(arr){

if(arr.length === 0) return null;

return arr[Math.floor(Math.random()*arr.length)];

}

function showOutfit(id,label,item){

const div = document.getElementById(id);

if(!item){
div.innerHTML = `${label}：无`;
return;
}

let imgHTML = "";

if(item.image){
imgHTML = `<img src="${item.image}">`;
}

div.innerHTML = `
${imgHTML}

<p>${label}：${item.name}</p>
`;

}

function saveClothes(){

localStorage.setItem("clothes",JSON.stringify(clothes));

}
renderClothes();