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

/**
 *  CF1 - Remove o valor do item correspodente ao EAN passado do valor do carrinho, retornando o produto
 *  @param {Request} request Requisicao contendo o EAN
 *  @param {Response} responsedo "Resposta" do servidor
 */
exports.cf1 = functions.https.onRequest(async (request, response) => {
  const ean = request.body.ean;
  let target = null;
  let subtotal = 0;
  const db = admin.database();
  const root = db.ref();
  const itensRef = root.child('carrinho/itens');

  try {
    const itemSnapshot = await itensRef.once('value');
    for (childSnapshot of itemSnapshot.val()) {
      if (childSnapshot.produto.ean != ean) {
        subtotal += childSnapshot.valor;
      } else {
        target = childSnapshot;
      }
    }

    const cartRef = root.child('carrinho');
    cartRef.update({ valor: subtotal });
    if (target == null) {
      response.status(400).send(['PRODUTO NAO ENCONTRADO']);
    } else {
      response.status(200).send(target);
    }
  } catch (error) {
    console.log(error);
    response.status(500).send('Ocorreu um problema! Por favor contate o suporte');
  }
});

/**
 *  CF2 - Monitora por atualizacoes no campo *stock* dos produtos cadastrados para atualizar o campo *disponivel*
 *  @param {DataSnapshot} change Contem os valores de antes e depois da atualizacao do campo *stock* dos produtos
 *  @param {EventContext} context Contem informacoes sobre o evento e os triggers
 *  @returns {Promise} Atualiza o campo *disponivel* do produto
 */
exports.cf2 = functions.database.ref('produtos/{produtosId}/stock').onUpdate((change, context) => {
  const before = change.before.val();
  const after = change.after.val();
  try {
    if (before != after) {
      if (after <= 0) {
        return change.after.ref.parent.update({ disponivel: false });
      } else {
        return change.after.ref.parent.update({ disponivel: true });
      }
    }
  } catch (error) {
    console.log(error);
    response.status(500).send('Ocorreu um problema! Por favor contate o suporte');
  }
});

/**
 *  CF3 - Monitoria o cadastro de novos produtos e direciona eles para um novo no (produtos_criados)
 *  @param {DataSnapshot} data Informacoes sobre os produtos (nome, ean, valor ...)
 *  @param {EventContext} context Informacoes sobre o evento e os triggers
 */
exports.cf3 = functions.database.ref('produtos/{produtosId}').onCreate((data, context) => {
  try {
    const produtoData = data.val();
    let avaliableValue = null;

    if (produtoData.stock != null && produtoData.ean && produtoData.valor && produtoData.nome) {
      if (produtoData.stock <= 0) {
        avaliableValue = false;
      } else {
        avaliableValue = true;
      }
      let produtosCriadosRef = admin.database().ref('produtos_criados');
      let newProductRef = produtosCriadosRef.push();

      newProductRef.set({
        disponivel: avaliableValue,
        ean: produtoData.ean,
        nome: produtoData.nome,
        stock: produtoData.stock,
        valor: produtoData.valor,
      });
    } else {
      console.log('Os campos Stock, Ean, Valor e Nome sao necessarios');
      response.status(400).send('Por favor preencha todos os campos!');
    }
  } catch (error) {
    console.log(error);
    response.status(500).send('Ocorreu um problema! Por favor contate o suporte');
  }
});
