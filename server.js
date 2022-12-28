const express = require('express');
const res = require('express/lib/response');
const neo4j = require('neo4j-driver');
const path = require('path');

const app = express();
const port = 5000;
app.listen(port);
app.use(express.json());
app.use(
    express.urlencoded({
        extended: true,
    })
);
app.use(express.static("public"));

const uri = 'neo4j+s://0148a10e.databases.neo4j.io';
const user = 'neo4j';
const dbPassword = 'xSA8XYVxZaZEWPQEdMKnmvxgA0zzmrGtsYuaxT3b2TQ';
const driver = neo4j.driver(uri, neo4j.auth.basic(user, dbPassword));
let login = "none"
let password = "none"
let person = ""
let friends = []
let posts = []

async function initDriver(uri, username, password) {
    let dbDriver = neo4j.driver(
        uri,
        neo4j.auth.basic(
            username,
            password
        )
    )

    await dbDriver.verifyConnectivity()

    return dbDriver
}

async function closeDriver() {
    if (driver) {
        await driver.close()
    }
}


function loginDB() {

}

function registerDB() {

}


app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname + "/views/index.html"));
})

app.get("/getLogin", (req, res) => {
    console.log(JSON.stringify(login));
    res.send(JSON.stringify(login));
})

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname + "/views/login.html"));
})

app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname + "/views/register.html"));
})

app.get("/posts", (req, res) => {
    posts = getPosts(res);
})

app.get("/addFriend", (req, res) => {
    res.sendFile(path.join(__dirname + "/views/addFriend.html"));
})

app.get("/newPost", (req, res) => {
    res.sendFile(path.join(__dirname + "/views/newPost.html"));
})

app.get("/logout", (req, res) => {
    login = "none"
    password = "none"
    res.redirect("/");
})

app.post("/login", async (req, res) => {
    await loginPerson(driver, req.body.login, req.body.password, res);
})

app.post("/register", (req, res) => {
    login = req.body.login;
    password = req.body.password;
    createPerson(driver, login, password);
    res.redirect("/");
})

app.post("/newPost", (req, res) => {
    let post = req.body.newPost;
    newPost(post)
    res.redirect("/");
})

app.post("/addFriend", (req, res) => {
    let friendLogin = req.body.friendLogin;
    addFriend(friendLogin);
    res.redirect("/");
})


async function addFriend(friendLogin) {

    try {
        const person1Name = login;
        const person2Name = friendLogin;
        await findPerson(driver, person1Name);
        await findPerson(driver, person2Name);
        await createFriendship(driver, person1Name, person2Name);


    } catch (error) {
        console.error(`Something went wrong: ${error}`);
    }

}

async function loginPerson(driver, personName, nodePassword, res) {

    const session = driver.session({ database: 'neo4j' });
    try {
        const readQuery = `MATCH (p:Person)
                        WHERE p.login = $personName AND p.password = $nodePassword
                        RETURN p.login AS name`;

        const readResult = await session.executeRead(tx =>
            tx.run(readQuery, { personName, nodePassword })
        );

        console.log(readResult)
        if (readResult.records.length != 0) {
            readResult.records.forEach(record => {
                console.log(`Found person: ${record.get('name')}`)
                login = personName;
                password = nodePassword;
            });
        }
        else {
            throw "Person not found"
        }
    } catch (error) {
        console.error(`Something went wrong: ${error}`);
    }
    finally {
        res.redirect("/");
    }
}

async function createFriendship(driver, person1Name, person2Name) {

    const session = driver.session({ database: 'neo4j' });

    try {
        const writeQuery = `MATCH (p1:Person) WHERE p1.login = $person1Name
                            MATCH (p2:Person) WHERE p2.login = $person2Name
                            MERGE (p1)-[:KNOWS]->(p2)
                            RETURN p1, p2`;

        const writeResult = await session.executeWrite(tx =>
            tx.run(writeQuery, { person1Name, person2Name })
        );

        writeResult.records.forEach(record => {
            const person1Node = record.get('p1');
            const person2Node = record.get('p2');
            console.info(`Created friendship between: ${person1Node.properties.login}, ${person2Node.properties.login}`);
        });

    } catch (error) {
        console.error(`Something went wrong: ${error}`);
    } finally {
        // Close down the session if you're not using it anymore.
        await session.close();
    }
}

async function createPerson(driver, personName, password) {

    const session = driver.session({ database: 'neo4j' });

    try {
        const writeQuery = `MERGE (p1:Person{ login: $personName, password: $password  }) 
                            RETURN p1`

        const writeResult = await session.executeWrite(tx =>
            tx.run(writeQuery, { personName, password })
        );

    } catch (error) {
        console.error(`Something went wrong: ${error}`);
    } finally {
        await session.close();
    }
}

async function findPerson(driver, personName) {

    const session = driver.session({ database: 'neo4j' });

    try {
        const readQuery = `MATCH (p:Person)
                        WHERE p.name = $personName
                        RETURN p.name AS name`;

        const readResult = await session.executeRead(tx =>
            tx.run(readQuery, { personName })
        );

        readResult.records.forEach(record => {
            console.log(`Found person: ${record.get('name')}`)
        });
    } catch (error) {
        console.error(`Something went wrong: ${error}`);
    } finally {
        await session.close();
    }
}

async function newPost(post) {
    const session = driver.session({ database: 'neo4j' });

    try {
        const writePostQuery = `CREATE (p1:Post {content: $post }) 
                                WITH p1
                                MATCH (n:Person {login: $login})
                                CREATE (n)-[:SAYS]->(p1)`

        const writePostResult = await session.executeWrite(tx =>
            tx.run(writePostQuery, { post, login })
        );

    } catch (error) {
        console.error(`Something went wrong: ${error}`);
    } finally {
        await session.close();
    }
}

async function getPosts(res) {

    results = {};
    const session = driver.session({ database: 'neo4j' });

    try {
        const readQuery = `MATCH (p1:Person {login: $login}) -[:KNOWS]-> (p2:Person)
                        WITH p2 AS per
                        MATCH (per) -[:Says]-> (post:Post)
                        RETURN per.login as name, post.content as content`;

        const readResult = await session.executeRead(tx =>
            tx.run(readQuery, { login })
        );

        let counter = 0;
        readResult.records.forEach(record => {
            console.log(`Found post: ${record.get('content')}`)
            results[record.get('name') + "#" + counter] = record.get('content')
            counter++;
        });

        // 
        res.send(JSON.stringify(results));

    } catch (error) {
        console.error(`Something went wrong: ${error}`);
    } finally {
        await session.close();
    }

}
