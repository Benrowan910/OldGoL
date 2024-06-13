import Phaser, { Data } from 'phaser'
import CONFIG from '../config'
import AlertManager from '../gamelogic/GameAlert.js'
import { MidgameWildcards } from '../minigames/WildcardMenu'

function r_p () { return Phaser.Math.RND.pick(...arguments) }
function r_btwn () { return Phaser.Math.RND.between(...arguments) }

/*
RNG with an added touch of certainty. Can be reset.
*/
class RNGMax {
  constructor (startingCount, callback) {
    this.callback = callback
    this.count = startingCount
    this.beginning = startingCount
  }

  proc () {
    const outcome = r_btwn(0, this.count)
    if (outcome === 0) {
      return true
    } else {
      this.count -= 1
      return false
    }
  }

  reset () {
    this.count = this.beginning
  }
}

/*
THE DATAMAKER
The DataMaker is an object designed to share data between the other classes of the game.
Consequently, it's also where most of the game's logic lies.
Its responsibilities include:
  knowing the game state,
  generating data for the cards,
  and responding acccordingly when a card is played.
*/

const DataMaker = {
  wildcards:
  {
    eventOutdoors: false,
    notifyFlags: function () {
      this.eventOutdoors = true
    }
  },
  game: {
    chooseClient: function () {},
    setup: function (mainScene) {
      this.money = r_btwn(850, 1000)
      this.timeSlots = r_btwn(3, 5)
      this.popularity = 0
      this.attendees = 0
      this.startDate =0
      this.dueDate = 12
      this.hotelDate = 6
      this.turnCount = this.startDate
      this.actions = 0
      this.banquet_complete = false
      this.RUI = undefined
      this.LUI = undefined
      this.banquetRNG = new RNGMax(6)
      this.gameScene = mainScene
      this.hotel.setup()
      this.eventPayment = 0
      this.dontDraw = false
      this.gameEnd = false
      this.countEnd = 0
      this.stopCheck = false
      this.attCheck = false
      this.popCheck = false
      this.moneyCheck = false
      this.fullCheck = false
      // console.log(this.hotel)
    },
    postTurn: function () { // currently does nothing, stuff that happens between turns, orginal was used for curveballs
      if (DataMaker.game.hotelDate === DataMaker.game.turnCount + 1) {
        DataMaker.game.HotelPayment()
      }
      this.actions = 0
    },
    countActions: function () {
      this.actions += 1
      this.RUI.setTurns(CONFIG.DRAWS_PER_ROUND - this.actions) // Indicate how many turns are left.
      if (this.actions >= CONFIG.DRAWS_PER_ROUND) {
        this.board.AdvanceTurn()
        this.actions = 0
      }
      console.log(this.actions)
    },
    turnNotifications: function () {
      if (this.turnCount === this.hotelDate) {
        AlertManager.alertN(['The date for the hotel contract just passed.', 'Cards from the Hotel deck have no effect now.'])
        this.dontDraw = true
      }
      if (this.turnCount === this.dueDate) {
        AlertManager.alertN(['The date of the event has arrived!', 'It\'s time to see how things play out.'])
        this.gameEnd = true
        this.stopCheck = true
        this.attCheck = true

      }
    },
    HotelPayment: function () {
      if (DataMaker.game.hotel.cost <= DataMaker.game.money) {
        DataMaker.game.money -= DataMaker.game.hotel.cost
        DataMaker.game.attendees += DataMaker.game.hotel.attendees
        DataMaker.game.popularity += DataMaker.game.hotel.popularity
        DataMaker.game.RUI.updateText()
      } else {
        AlertManager.alertN(['You do not have enough money to pay for the hotel', 'You lose!'])
      }
    },
    HotelAttrition: function () {
      if (DataMaker.game.hotel.attendeeGoal <= DataMaker.game.attendees) {
        AlertManager.alertN(['The date of the event has arrived!', 'You get a discount'])
        DataMaker.game.money += DataMaker.game.hotel.discount
      } else {
        AlertManager.alertN(['The date of the event has arrived!', 'Pay the attrition fee'])
        DataMaker.game.money -= DataMaker.game.hotel.fee
      }
    },
    hotel: { // The part of the game logic that handles the various things that can happen with hotels.
      name: '',
      cost: 0,
      amenities: 0,
      attendeeCap: 0,
      popularity: 0,
      attendeeGoal: 0,
      discount: 0,
      fee: 0,
      attendees: 0,
      setup: function () {
        this.name = ''
        this.cost = 0
        this.amenities = 0
        this.attendeeCap = 0
        this.popularity = 0
        this.attendeeGoal = 0
        this.discount = 0
        this.fee = 0
        this.attendees = 0
      }
    }

  },
  card:
  {
    play: function (cardData) {
      let update = false
      if (cardData.type === 'hotel' || cardData.type === 'amenities') {
        if (DataMaker.game.turnCount < DataMaker.game.hotelDate) {
          if (cardData.type === 'hotel') {
            DataMaker.game.hotel.name = cardData.name
            DataMaker.game.hotel.cost = cardData.cost
            DataMaker.game.hotel.attendeeCap = cardData.attendeeCap
            DataMaker.game.hotel.popularity = cardData.popularity
            DataMaker.game.hotel.attendeeGoal = cardData.attendeeCap * cardData.feePercent
            DataMaker.game.hotel.discount = cardData.discount
            DataMaker.game.hotel.fee = cardData.fee
          }
          if (cardData.type === 'amenities') {
            DataMaker.game.hotel.amenities++
            DataMaker.game.hotel.cost = cardData.cost
            DataMaker.game.hotel.popularity = cardData.hotelPopularity
            DataMaker.game.hotel.attendees = cardData.hotelAttendees
          }
        }
        DataMaker.game.countActions()
        DataMaker.game.LUI.updateStatus()
      } else {
        if (cardData.cost && !cardData.turns) {
          DataMaker.game.money -= cardData.cost
          update = true
        }

        if (cardData.eventPayment) {
          DataMaker.game.eventPayment += cardData.eventPayment
        }

        if (cardData.travelFee) {
          DataMaker.game.money -= cardData.travelFee
          update = true
        }

        if (cardData.downpayment) {
          DataMaker.game.money += cardData.downpayment
          update = true
        }

        if (cardData.timeSlots > 0) {
          console.log('card has ts')
          DataMaker.game.timeSlots -= cardData.timeSlots
          update = true
        }

        if (cardData.attendees) {
          DataMaker.game.attendees += cardData.attendees
          update = true
        }

        if (cardData.popularity) {
          DataMaker.game.popularity += cardData.popularity
          update = true
        }

        if (cardData.money && !cardData.turns) {
          DataMaker.game.money += cardData.money
          update = true
        }

        if (cardData.actions === 2) {
          DataMaker.game.countActions()
        }

        if (cardData.type === 'partnership') {
          update = true
        }
        DataMaker.game.countActions()

        if (update) {
          DataMaker.game.RUI.updateText()
        }
      }
    },
    payCost: function (cost) {
      DataMaker.game.money -= cost
      DataMaker.game.RUI.updateText()
    },
    addMoney: function (money) {
      DataMaker.game.money += money
      DataMaker.game.RUI.updateText()
    },
    //making data for the hotel cards, mainly the package that is drawn
    makeHotelData1: function () { // The hotel cards work a bit differently
      const amenityName = Phaser.Math.RND.pick(['Hot Tub and Pool', 'Hotel Bar', 'Continental Breakfast', 'Hotel Gym'])
      amenities = []
      switch(amenityName){
        case 'Hot Tub and Pool':
          amenities = {
            name: amenityName,
            type: 'amenities',
            cost: 50,
            hotelAttendees: 10,
            hotelPopularity: 10
          }
          break
        case 'Hotel Bar':
          amenities = {
            name: amenityName,
            type: 'amenities',
            cost: 50,
            hotelAttendees: 10,
            hotelPopularity: 10
          }
          break
        case 'Continental Breakfast':
          amenities = {
            name: amenityName,
            type: 'amenities',
            cost: 50,
            hotelAttendees: 10,
            hotelPopularity: 10
          }
          break
        case 'Hotel Gym':
          amenities = {
            name: amenityName,
            type: 'amenities',
            cost: 50,
            hotelAttendees: 10,
            hotelPopularity: 10
          }
          break
      }
      const c = amenities
      return c
    },
    //making the entertainment data cards
    makeEntertainmentData1: function () {
      const speaker = {
        name: 'Subject Matter Expert',
        eventPayment: 250,
        travelFee: 25,
        cost: 250,
        timeSlots: 1,
        popularity: 50
      }
      const professional = {
        name: 'Industry Professional',
        cost: 500,
        travelFee: 25,
        timeSlots: 1,
        popularity: 75
      }
      const demonstration = {
        name: 'Demonstration',
        eventPayment: 600,
        cost: 200,
        timeSlots: 2,
        popularity: 100
      }
      const band = {
        name: 'Awesome band',
        eventPayment: 400,
        cost: 400,
        timeSlots: 2,
        popularity: 80
      }
      const c = r_p([speaker, professional, demonstration, band])
      return c
    },
    //making the marketing data cards
    makeMarketingData1: function () {
      const radio = {
        name: '15 Second Radio Ad',
        turns: 3,
        cost: 25,
        attendees: r_btwn(25, 50),
        popularity: 5
      }
      const socialMedia = {
        name: 'Social Media Campaign',
        cost: 50,
        attendees: r_btwn(51, 100),
        popularity: 10
      }
      const youtubeAd = {
        name : 'YouTube Campaign',
        cost: 200,
        attendees: r_btwn(150, 200),
        popularity: 15
      }
      const billboard = {
        name: 'Billboard Ad',
        cost: 800,
        attendees: r_btwn(250, 350),
        popularity: 25
      }
      const publicFigure = {
        name: 'Public Figure',
        cost: 1000,
        attendees: r_btwn(400,500),
        popularity: 50
      }

      const c = r_p([billboard, socialMedia, radio, publicFigure])
      return c
    },
    //making the fun data cards
    makeFundData1: function () { // Now called the Sponsor deck. Intended to generate revenue, whereas Marketing generates interest in the event / participation.
      const sponsorNames = ['Zonko Cola', 'Beanslinger Billy', 'Dragons and Donuts', 'The Ouch Time']
      const sponsor = {
        name: r_p(sponsorNames),
        type: 'sponsorship',
        actions: 2,
        turns: 3,
        money: r_btwn(125, 175)
      }

      const partnershipNames = ['Kaiju Vigor', 'Stepgo', 'Sundough']
      const partnership = {
        name: r_p(partnershipNames),
        type: 'partnership',
        pFee: 100,
        pMoney: r_btwn(450, 550),
        pTurns: 3,
        deadline: true
      }

      const d = r_p([sponsor/*, partnership */]) // taking partnership out because it doesn't work
      return d
    },
    makePartnershipData1: function (fee, money, turns, deadline) { // Make the partnership card that some fund cards generate
      const partnership = {
        name: 'Partnership',
        type: 'partnership',
        fee: fee,
        money: money,
        turns: turns,
        deadline: deadline
      }

      const d = partnership
      return d
    },
    NNoRepeats: function (n, l) {
      let L = [...l]
      const d = []
      for (let i = 0; i < r_btwn(1, n); i++) {
        L = Phaser.Math.RND.shuffle(L)
        d.push(L.pop())
      }
      return d
    },
    lerp: function (a, b, t) {
      return a + (b - a) * t
    }
  }
}

export default DataMaker
