const express = require ('express'); //Import express and call it as a function to create an express app.
const app = express(); //The express app finds multiple https end-points that can be accessed on the internet. 
const stripe = require('stripe')('sk_test_51MDK0xGACzjkGP0mQwoxB3qEt3pAEMpfENvzYiERSvfLOrzBPl0zkFWb95xIm6NZbyeB4KSvXo9WJrNc3aUWGTch00Kg3cVMmr');
//TODO Implement a real database
// Reverse mapping of stripe to API key
app.listen(8080, () => console.log('live on http://localhost:8080'));

const customers = {
    // stripeCustomerId : data
    stripeCustomerId: {
        apiKey: '123xyz',
        active: false,
        itemId: 'stripeItemId',
        calls: 0,
    },
};
const apiKeys = {
    // apiKey : customerdata
    '123xyz': 'cust1',
};
// generate an API key with Node
function generateAPIKey() {
    const { randomBytes } = require('crypto');
    const apiKey = randomBytes(16).toString('hex');
    const hashedAPIKey = hashAPIKey(apiKey);
    // Ensure API key is unique
    if (apiKeys[hashedAPIKey]) {
        generateAPIKey();
    } else {
        return { hashAPIKey, apiKey };
    }
}

// Compare the API key to hashed version in database
function hashAPIKey(apiKey) {
    const { createHash } = require('crypto');
    const hashedAPIKey = createHash('md5').update(apiKey).digest('hex');
    
    return hashedAPIKey
}

//RESTapi every endpoint starts with a verb.GET, POST, PUT, PATCH, DELETE.
//  GET = FETCH DATA
//  POST = CREATE DATA
//  DELETE = DESTROY DATA

//  In express, can define API end point with a verb as a function. Line Below = app.GET
app.get('/api', async ( req, res ) => {    
    const { apiKey } = req.query;

    if (apiKey) {
        res.sendStatus(400); //Bad request
    }
    const hashedAPIKey = hashAPIKey(apiKey)
    
    const customerId = apiKeys[hashAPIKey];
    const customer = customers [customerId];

    if (!customer.active) {
        res.sendStatus(403); //not authorized
    } else {
        // Record usage with Stripe Billing
        const record = await stripe.subscriptionItems.createUsageRecord(
            customer.itemId, 
            { 
                quantity: 1,
                timestamp: 'now',
                action: 'increment',
            }
        );
    }

        res.send({ data: 'oh baby, was this the info you wanted?'})

});

// Create a Stripe checkout session to create a customer
// Created another end point called checkout, this time using post and pointing it to the /checkout route.
// Making the callback an 'async' function because the stripe STK is promise based.
// When the URL is triggered it makes a request to stripe to start a new checkout session, then will send the details of the session back to the client.

app.post('/checkout', async (req, res) => {
    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
            {
                price: 'price_1MDK2oGACzjkGP0mzSvgZezA'
            },
        ],
        success_url: 'http://localhost:5000/successs?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'http://localhost:5000/error',
    });
    res.send(session);
});


// listen to webhooks from stripe when important events happen
app.post('/webhook', async (req, res) => {
    let data;
    let eventType;
    //check if webhook signing is confirmed
    const webhookSecret = 'whsec_18cfdc8dd8bce2d0e86dfb5842b34f118d6ab7398a4db8a66a1c5d20c8a8db0a';

    if (webhookSecret) {
        //Retrieve the event by verifying the signature
        let event;
        let signature = req.headers['stripe-signature'];

        try {
            event = stripe.webhooks.constructEvent(
                req['rawBody'],
                signature,
                webhookSecret
            );
            } catch (err) {
                console.log ('Webhook signature verification failed.');
                return res.sendStatus(400);
            }
            // Extract thte object from the event
            data = event.data;
            eventType = event.type;
        } else {
            //webhook signing is recommended
            //retrieve the event data directly from the request body.
            data = req.body.data;
            eventType = req.body.type;
        }

        switch (eventType) {
            case 'checkout.session.completed':
                    // data included in the event object
                    const customerId = data.object.customer;
                    const subscriptionId = data.object.subscription;
                    
                    console.log('💰 Customer ${customerId} subscribed to  ');
            
                    // Get the subscription.
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    const itemId = subscription.items.data[0].id;

                    // Generate API key
                    const { apiLey, hashedAPIKey } = generateAPIKey();
                    console.log('Generated Unique API Key: ${apiKey}');

                    // Store the API key in your database
                    customers[customerId] = { apikey: hashAPIKey, itemId, active:true, calls:0 }
                    apiKeys[hashAPIKey] = customerId;

                break;
            case 'invoice.paid':
                break;
            case 'invoice.payment_failed':

            default:
                //Unhandled event type
        }
});

