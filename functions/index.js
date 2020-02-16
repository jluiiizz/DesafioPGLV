const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// FUNCAO CRIADA UNICA E EXCLUSIVAMENTE PARA TESTAR A CLOUD FUNCTION 3!!
// POIS NAO ESTAVA CONSEGUINDO CRIAR REGISTROS PELO CHROME DEVIDO A QUANTIDADE DE REGISTROS NO **NÓ** "PRODUTOS"
exports.createProduct = functions.https.onRequest(async (request, response) => {
  const ean = request.body.ean;
  const nome = request.body.nome;
  const stock = request.body.stock;
  const valor = request.body.valor;

  const db = admin.database();
  const root = db.ref();
  const productsRef = root.child('produtos');

  try {
    const newProdRef = productsRef.push();
    newProdRef.set({
      ean: ean,
      nome: nome,
      stock: stock,
      valor: valor,
    });
    response.send('Ok');
  } catch (error) {
    console.log(error);
  }
});

// CF1
exports.cf1 = functions.https.onRequest(async (request, response) => {
  // Salva o valor do request.body.ean na constante ean
  const ean = request.body.ean;
  let target = null; // Variável a ser usada para salvar o produto que terá o valor subtraido do total do carrinho
  let subtotal = 0; // Valor do Subtotal do Carrinho
  const db = admin.database();
  const root = db.ref(); // Referencia ./ o diretorio raiz
  const itensRef = root.child('carrinho').child('itens'); // Referencia o seguinte path: ./carrinho/itens

  try {
    const itemSnapshot = await itensRef.once('value'); // Constante que recebe os nós do carrinho e todos seus demais valores
    itemSnapshot.forEach(childSnapshot => {
      // Percorre **itemSnapshot** acessando cada nó interno e checando se seu EAN corresponde
      if (
        // ao EAN enviado pelo body!
        childSnapshot
          .child('produto')
          .child('ean')
          .val() != ean
      ) {
        // Caso seja diferente, significa que o produto não é o procurado, então seu valor pode ser adicionado ao subtotal do carrinho
        subtotal += childSnapshot.child('valor').val();
      } else {
        // Caso seja igual, significa que o produto é o procurado, então ele não possui seu valor adicionado ao subtotal
        target = childSnapshot.val(); // O valor fica salvo na variável target para que futuramente verifiquemos se o produto pesquisado existe ou não
      }
    });

    const cartRef = root.child('carrinho'); // Referencia o path ./carrinho
    cartRef.update({ valor: subtotal }); // Atualiza o valor do carrinho para o obtido atraves da soma dos produtos com (ean) != (ean do produto procurado)
    // Verifica se o produto realmente existe ou não
    if (target == null) {
      // Caso nao exista a seguinte string é retornada
      response.send(['PRODUTO NAO ENCONTRADO']);
    } else {
      // Caso exista o valor do EAN correspondente ao produto a ser subtraido do carrinho é retornado
      response.send([ean]);
    }
  } catch (error) {
    console.log(error);
  }
});

// CF2
exports.cf2 = functions.database.ref('produtos/{produtosId}').onUpdate((change, context) => {
  const before = change.before.val(); //
  const after = change.after.val();

  // Verifica se existe um campo estoque
  if (before.stock != null) {
    // Caso exista um campo stock ele verifica se realmente houve alguma alteração nos dados para que não entre em loop
    if (before.stock == after.stock) {
      return null;
    } else {
      // Verifica o valor do campo **stock** e atualiza o valor do campo **disponivel** de acordo 
      if (after.stock <= 0) {
        return change.after.ref.update({ disponivel: false }); 
      } else {
        return change.after.ref.update({ disponivel: true });
      }
    }
  } else { // Caso nao haja um campo **stock** o valor do campo **disponivel** é atualizado para **false**
    return change.after.ref.update({ disponivel: false });
  }
});

// CF3
exports.cf3 = functions.database
  .ref('produtos/{produtosId}')
  .onCreate((data, context) => {
    const produtoData = data.val();
    let avaliableValue = null; // Variavel para armazenar o valor do campo **disponivel**

    // Verifica se todos os campos (stock, ean, valor, nome) existem
    // Em particular o **produtoData.stock** teve que ser escrito como (!= null) para que quando seu valor fosse 0...
    // ... não haja conflito pensando que o seu valor não existe
    if (produtoData.stock != null && produtoData.ean && produtoData.valor && produtoData.nome) {
      // Verifica o valor do campo **stock**
      if (produtoData.stock <= 0) { 
        avaliableValue = false; 
      } else {
        avaliableValue = true;
      }
      let produtosCriadosRef = admin.database().ref('produtos_criados'); // Referencia o novo nó **produtos_criados**
      let newProductRef = produtosCriadosRef.push(); // Configura a referencia para que novos valores sejam adicionados sem interferir em outros
      // Passa os valores já obtidos e o campo **disponivel** com o valor correto
      newProductRef.set({
        disponivel: avaliableValue,
        ean: produtoData.ean,
        nome: produtoData.nome,
        stock: produtoData.stock,
        valor: produtoData.valor,
      });
      return null;
    } else {
      console.log('Os campos Stock, Ean, Valor e Nome sao necessarios');
      return null;
    }
  });
