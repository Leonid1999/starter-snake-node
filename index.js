const bodyParser = require('body-parser')
const express = require('express')
const logger = require('morgan')
const app = express()
const PF = require('pathfinding');
const {
  fallbackHandler,
  notFoundHandler,
  genericErrorHandler,
  poweredByHandler
} = require('./handlers.js')

// For deployment to Heroku, the port needs to be set using ENV, so
// we check for the port number in process.env
app.set('port', (process.env.PORT || 9001))

app.enable('verbose errors')

app.use(logger('dev'))
app.use(bodyParser.json())
app.use(poweredByHandler)

// --- SNAKE LOGIC GOES BELOW THIS LINE ---

// Handle POST request to '/start'
app.post('/start', (request, response) => {
  // NOTE: Do something here to start the game

  // Response data
  const data = {
    color: '#7BDFF2',
    headType: "dead",
	  tailType: "hook"
  }

  return response.json(data)
})

// Handle POST request to '/move'
app.post('/move', (request, response) => {
  // NOTE: Do something here to generate your move
  const gameState = request.body;
  console.log(request.body);

  function setMove(path, head) {
    if (path[1][0] === head.x && path[1][1] === head.y + 1) {
      return 'down';
    } else if (path[1][0] === head.x && path[1][1] === head.y - 1) {
      return 'up';
    } else if (path[1][0] === head.x + 1 && path[1][1] === head.y) {
      return 'right';
    } else if (path[1][0] === head.x - 1 && path[1][1] === head.y) {
      return 'left';
    } else {
      return 'down';
    }
  }
  
  //Determines the distance from the snakes head to something
  const getDistance = (a, b, head) => (Math.abs(a - head.x) + Math.abs(b - head.y));
  
  //return the closest food item
  function findFood(gs) {
    const allTargets = [];
    for (let i in gs.board.food) {
      let distance = getDistance(gs.board.food[i].x, gs.board.food[i].y, myHead);
      //Add a weight that reduces the likelihood of targeting wall food
      if (!gs.board.food[i].x || !gs.board.food[i].y || gs.board.food[i].x === gs.board.width - 1 || gs.board.food[i].y === gs.board.height - 1) {
        distance += 10;
      }
      
      allTargets.push({
        x: gs.board.food[i].x,
        y: gs.board.food[i].y,
        distance: distance
      });
  
    }
    //Sort by weighted distance
    allTargets.sort(function (a, b) {
      return a.distance - b.distance;
    });
    //Return the closest
    return allTargets[0];
  } 
  
  function chooseTarget(gs) {
      return findFood(gs);
  }

  const myHead = {
    x: gameState.you.body[0].x,
    y: gameState.you.body[0].y
  };
  const grid = new PF.Grid(gameState.board.width, gameState.board.height);

   //Marks areas on the Grid where the snake can't pass into
   function setGrid(gs, grid) {
    //Mark my snake in grid
    for (let i = 1; i < gs.you.body.length - 1; i++) {
      grid.setWalkableAt(gs.you.body[i].x, gs.you.body[i].y, false);
    }
    //Mark other snake heads
    const allSnakes = gs.board.snakes
    for (let snake in allSnakes) {
      if (allSnakes[snake].id !== gs.you.id) {
        
        for (let j = 0; j < allSnakes[snake].body.length - 1; j++) {
          grid.setWalkableAt(allSnakes[snake].body[j].x, allSnakes[snake].body[j].y, false);
        }
        //Could we run into the head this turn
        if (getDistance(allSnakes[snake].body[0].x, allSnakes[snake].body[0].y, myHead) === 2) {

          //Decide on head collision depending on size
          if (gs.you.length <= allSnakes[snake].length) {
            //Pathfinding will throw an error if we try to set a space outside the board
            if (allSnakes[snake].body[0].x + 1 < gs.board.width) {
              grid.setWalkableAt((allSnakes[snake].body[0].x + 1), allSnakes[snake].body[0].y, false);
            }
            if (allSnakes[snake].body[0].x - 1 >= 0) {
              grid.setWalkableAt((allSnakes[snake].body[0].x - 1), allSnakes[snake].body[0].y, false);
            }
            if (allSnakes[snake].body[0].y + 1 < gs.board.height) {
              grid.setWalkableAt(allSnakes[snake].body[0].x, (allSnakes[snake].body[0].y + 1), false);
            }
            if (allSnakes[snake].body[0].y - 1 >= 0) {
              grid.setWalkableAt(allSnakes[snake].body[0].x, (allSnakes[snake].body[0].y - 1), false);
            }
          }
        }
      }
    }
  }

  setGrid(gameState, grid);
  const closestTarget = chooseTarget(gameState);
  const finder = new PF.AStarFinder;
  const path = finder.findPath(myHead.x, myHead.y, closestTarget.x, closestTarget.y, grid);
  const snakeResponse = {};

  if (!path.length || (path.length === 2 && !grid.nodes[path[0][1]][path[0][0]].walkable)) {
    // console.log('NO PATH')
    const possibleMoves = [
      {
        direction: "right",
        x: myHead.x + 1,
        y: myHead.y,
        valid: true
      },
      {
        direction: "down",
        x: myHead.x,
        y: myHead.y + 1,
        valid: true
      },
      {
        direction: "left",
        x: myHead.x - 1,
        y: myHead.y,
        valid: true
      },
      {
        direction: "up",
        x: myHead.x,
        y: myHead.y - 1,
        valid: true
      },
    ];

    function checkSelf(gs, pm) {
      for (let i = 0; i < gs.you.body.data.length-1; i++) {
        for (let move in pm) {
          if (pm[move].x === gs.you.body.data[i].x && pm[move].y === gs.you.body.data[i].y) {
            pm[move].valid = false;
          }
        }
      }
    }

    //Stop from running into wall
    function checkEdges(gs, pm) {
      for (let move in pm) {
        if (pm[move].x < 0 || pm[move].x >= gs.width) {
          pm[move].valid = false;
        }
        if (pm[move].y < 0 || pm[move].y >= gs.height) {
          pm[move].valid = false;
        }
      }
    }

    checkSelf(gameState, possibleMoves);
    checkEdges(gameState, possibleMoves);

    
    const validMoves = [];
    for (let i in possibleMoves) {
      if (possibleMoves[i].valid) {
        validMoves.push(possibleMoves[i]);
      }
    }

    // if no spaces are safe, this will allow to move into spaces bigger snakes can allow move into
    if (!validMoves.length) {
      // console.log('NO PATH, NO OPEN MOVES');

      //Reset possibleMoves
      for (let i in possibleMoves) {
        possibleMoves[i].valid = true
      }
      
      
    }

    snakeResponse.move = validMoves[0].direction;
    return response.json(snakeResponse);

  } else {
    
    snakeResponse.move =  setMove(path, myHead);

    return response.json(snakeResponse);

  }

  
  // Response data
  const data = {
    move: 'up', // one of: ['up','down','left','right']
  }

  return response.json(data)
})


app.post('/end', (request, response) => {
  // NOTE: Any cleanup when a game is complete.
  return response.json({})
})

app.post('/ping', (request, response) => {
  // Used for checking if this snake is still alive.
  return response.json({});
})

// --- SNAKE LOGIC GOES ABOVE THIS LINE ---

app.use('*', fallbackHandler)
app.use(notFoundHandler)
app.use(genericErrorHandler)

app.listen(app.get('port'), () => {
  console.log('Server listening on port %s', app.get('port'))
})
