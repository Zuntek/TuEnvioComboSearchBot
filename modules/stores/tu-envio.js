const $ = require('cheerio');
const bot_module = require('../bot-module');
const product_list_operations = require('../products-list-operations')

exports.process_response = function (res) {
    if (res.options.page_type == "product_list") {
        console.log('Revisando ' + res.options.store);
        process_product_list_response(res);
    } else {
        process_product_response(res);
    }
}

function process_product_list_response(res) {
    const opt = res.options;
    const products_url_list = craw_product_list_page(res.$, opt.base_url);
    const new_products_url_list = product_list_operations.get_new_products(products_url_list, opt.province);
    new_products_url_list.forEach(function (url) {
            console.log('Nuevo producto encontrado');
            product_list_operations.add_product(url, opt.province, opt.store);
            create_url_request(url, opt);
        }
    );
}

function craw_product_list_page(page, base_url) {
    let products_list = [];
    page(".hProductItems .thumbTitle a").each(function (i, elem) {
        products_list.push(base_url + $(this).attr('href'));
    });
    return products_list;
}

function process_product_response(res) {
    if (product_is_available(res) && !invalid_product(res)) {
        if (valid_response(res)) {
            console.log('Publicando nuevo producto ' + res.options.uri);
            let product = get_product_info(res);
            let message = create_message(product, res);
            bot_module.send_message(message, product);
        } else {
            console.log('Cargo mal el producto, solicitandolo again ' + res.options.uri);
            create_url_request(res.options.uri, res.options);
        }
    } else {
        console.log('El Producto Ya no estaba disponible ' + res.options.uri);
    }
}

function valid_response(res) {
    let valid_response = false;
    if (res.$('.product-title h4').text() != '')
        valid_response = true;
    if (res.$('.product-price span').text() != '')
        valid_response = true;
    return valid_response
}

function product_is_available(res) {
    const unavailability_message = 'El producto que usted busca no esta disponible en nuestra tienda.';
    const unavailability_selector = '#ctl00_cphPage_formProduct_ctl00_productError_missingProduct';
    return res.$(unavailability_selector).text() == unavailability_message ? false : true;
}

function invalid_product(res) {
    return res.$("#ctl00_cphPage_lblError").text() == 'Ocurrió un error!!!' ? true : false;
}

function get_product_info(res) {
    var product = {
        title: res.$('.product-title h4').text() || "Kit Mixto",
        price: res.$('.product-price span').text(),
        store: res.options.store,
        province: res.options.province,
        url: res.options.uri,
        products: []
    }
    res.$('.product-tab table.table tr').each(function (i, elem) {
        const prod = {
            count: $(this).find('td').last().text(),
            name: $(this).find('td').first().text()
        }
        product.products.push(prod);
    })
    product.products.splice(0, 1);
    return product;
}

function create_message(product, res) {
    let message = [];
    message.push("\u{1F6CD}" + ` <b>${product.title}</b> \n`);
    message.push("\u{1F4B0}" + ` ${product.price} \n`);
    message.push("\u{1F3EA}" + ` ${product.store} \n`);
    message.push("-----------------------------------------------\n");
    product.products.forEach(function (item) {
        message.push(`<b>${item.count}</b> | ${item.name} \n`);
    })
    message.push("-----------------------------------------------\n");
    message.push("Publicado por @TuEnvioComboSearchBot");
    return message.join('');
}

function create_url_request(url, opt) {
    craw.queue({
        uri: url,
        page_type: "product",
        store_type: opt.store_type,
        province: opt.province,
        store: opt.store,
        base_url: opt.base_url
    });
}