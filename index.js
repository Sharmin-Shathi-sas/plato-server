const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();
require('dotenv').config();

const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://plato-restaurant.web.app',
    'https://plato-restaurant.firebaseapp.com',
    'https://plato-restaurant.vercel.app',
    '*',
    'http://0.0.0.0'
  ],
  credentials: true
}));



app.post("/login", (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).send({ message: "Email is required" });
  }

  const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "5h" });

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "None",
  });

  res.send({ message: "Login successful, token set in cookie" });
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qepyx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).send({ message: 'Unauthorized access: Missing token' });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized access: Invalid token' });
    }
    req.user = decoded;
    next();
  });
};


async function run() {
  try {
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const foodsCollection = client.db('platoRestaurant').collection('foods');
    const purchaseCollection = client.db('platoRestaurant').collection('purchased-foods');

    //auth related APIs
    app.post('/jwt', (req, res) => {
      const token = jwt.sign(req.body, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10h' });
      
      res.cookie('token', token, {
        httpOnly: true,
        secure: false,
        sameSite: 'None',
      });
      res.send({ success: true, token });
    });


    app.post("/logout", (req, res) => {
      res.clearCookie("token");
      res.send({ message: "Logged out successfully" });
    });

    // Route to get all foods
    app.get('/allfoods', async (req, res) => {

      try {
        const search = req.query?.search;
        const query = search ? { name: { $regex: search, $options: 'i' } } : {};
        const result = await foodsCollection.find(query).toArray();
        res.send(result);
      }
      catch (error) {
        res.status(500).send({ message: 'Failed to fetch all foods', error });
      }
    });

    // Route to get foods by email
    app.get('/added-foods', verifyToken, async (req, res) => {

      const email = req.query.email;
      if (!email) {
        return res.status(400).send({ message: 'Email query parameter is required' });
      }

      if (req.user.email !== email) {
        return res.status(403).send({ message: 'Forbidden: Email mismatch' });
      }

      try {
        const query = { "addedBy.email": email };
        const result = await foodsCollection.find(query).toArray();
        res.send(result);
      }

      catch (error) {
        res.status(500).send({ message: 'Failed to fetch foods by email', error });
      }
    });

    app.get('/top-foods', async (req, res) => {
      try {
        const topFoods = await foodsCollection.find({}).sort({ purchaseCount: -1 }).limit(6).toArray();
        res.send(topFoods);
      }
      catch (error) {
        res.send({ message: 'failed' });
      }
    })

    app.get('/allfoods/:id', async (req, res) => {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid ID format', receivedId: id });
      }
      try {
        const query = { _id: new ObjectId(id) };
        const result = await foodsCollection.findOne(query);
        if (!result) {
          return res.status(404).send({ message: 'Food not found' });
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Internal server error', error });
      }
    });

    app.post('/add-food', verifyToken, async (req, res) => {
      const foodItem = req.body;
      try {
        const newFoodItem = { ...foodItem, purchaseCount: 0 };
        const result = await foodsCollection.insertOne(newFoodItem);
        if (result.insertedId) {
          res.send({ success: true, message: 'Food item added successfully!' });
        } else {
          res.status(500).send({ success: false, message: 'Failed to add food item' });
        }
      }
      catch (error) {
        console.error("Error adding food item:", error);
        res.status(500).send({ success: false, message: 'Internal server error', error });
      }
    });

    app.get('/added-foods/:id', async (req, res) => {
      const id = req.params.id;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid ID format' });
      }

      try {
        const query = { _id: new ObjectId(id) };
        const result = await foodsCollection.findOne(query);

        if (!result) {
          return res.status(404).send({ message: 'Food not found' });
        }
        res.send(result);
      }
      catch (error) {
        console.error('Error fetching food:', error);
        res.status(500).send({ message: 'Internal server error', error });
      }
    });

    app.get('/added-foods/:id', async (req, res) => {
      const id = req.params.id;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid ID format' });
      }

      try {
        const query = { _id: new ObjectId(id) };
        const result = await foodsCollection.findOne(query);

        if (!result) {
          return res.status(404).send({ message: 'Food not found' });
        }

        res.send(result);
      } catch (error) {
        console.error('Error fetching food:', error);
        res.status(500).send({ message: 'Internal server error', error });
      }
    });

    app.put('/added-foods/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updatedFood = req.body;
      const food = {
        $set: {
          name: updatedFood.name,
          image: updatedFood.image,
          price: updatedFood.price,
          category: updatedFood.category,
          quantity: updatedFood.quantity,
          availability: updatedFood.availability,
          origin: updatedFood.origin,
          description: updatedFood.description
        }
      }
      const result = await foodsCollection.updateOne(filter, food, options);
      res.send(result);
    });


    app.get('/purchased-foods', verifyToken, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        return res.status(400).send({ message: 'Email query parameter is required' });
      }

      if (req.user.email !== email) {
        return res.status(403).send({ message: 'Forbidden: Email mismatch' });
      }

      try {
        const query = { customerEmail: email };
        const result = await purchaseCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error('Error fetching purchased foods:', error);
        res.status(500).send({ message: 'Internal Server Error', error });
      }
    });


    // Route to handle food purchase
    app.post('/purchased-foods', async (req, res) => {
      const purchased = req.body;
      const { food_id, customerEmail, quantity } = purchased;

      if (!ObjectId.isValid(food_id)) {
        return res.status(400).send({ success: false, message: 'Invalid food ID' });
      }

      const purchasedQuantity = parseInt(quantity, 10);
      if (!purchasedQuantity || purchasedQuantity <= 0) {
        return res.status(400).send({ success: false, message: 'Invalid quantity' });
      }

      try {
        const foodItem = await foodsCollection.findOne({ _id: new ObjectId(food_id) });
        if (!foodItem) {
          return res.status(404).send({ success: false, message: 'Food item not found' });
        }

        if (foodItem.addedBy.email === customerEmail) {
          return res.status(403).send({ success: false, message: 'You cannot purchase your own food item' });
        }

        const result = await purchaseCollection.insertOne(purchased);
        if (result.insertedId) {
          const foodQuery = { _id: new ObjectId(food_id) };
          const update = {
            $inc: { availability: -purchasedQuantity, purchaseCount: purchasedQuantity },
          };
          const updateResult = await foodsCollection.updateOne(foodQuery, update);

          if (updateResult.modifiedCount > 0) {
            return res.json({ success: true, message: 'Purchase recorded successfully' });
          } else {
            return res.status(500).send({ success: false, message: 'Failed to update food availability' });
          }
        } else {
          return res.status(500).send({ success: false, message: 'Failed to record purchase' });
        }
      } catch (error) {
        console.error("Error in /purchased-foods:", error);
        res.status(500).json({ success: false, message: 'Internal server error', error });
      }
    });


    app.delete('/purchased-foods/:id', async (req, res) => {
      const { id } = req.params;
      const { email } = req.query;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
      }

      const query = { _id: new ObjectId(id) };
      if (email) {
        query.customerEmail = email;
      }

      try {

        const purchasedItem = await purchaseCollection.findOne(query);
        if (!purchasedItem) {
          return res.status(404).json({ success: false, message: 'Order not found or does not belong to this email' });
        }

        const { food_id, quantity } = purchasedItem;

        // Delete the purchase record
        const deleteResult = await purchaseCollection.deleteOne(query);

        if (deleteResult.deletedCount > 0) {

          const foodQuery = { _id: new ObjectId(food_id) };
          const update = {
            $inc: { availability: parseInt(quantity, 10), purchaseCount: -parseInt(quantity, 10) },
          };

          const updateResult = await foodsCollection.updateOne(foodQuery, update);

          if (updateResult.modifiedCount > 0) {
            res.json({ success: true, message: 'Order deleted and food availability updated successfully' });
          } 
          else {
            res.status(500).json({ success: false, message: 'Order deleted, but failed to update food availability' });
          }
        } 
        else {
          res.status(404).json({ success: false, message: 'Order not found or already deleted' });
        }
      }
      catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete the order', error });
      }
    });

    app.get('/', (req, res) => {
      res.send('Plato Connected');
    });
  }
  finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Plato Connected')
})

app.listen(port, () => {
  // console.log(`plato is waiting at: ${port}`)
})