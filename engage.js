// File: engage.js
//
// Parameters (passed to webpage) 
//    class - class (matches google sheet workbook name)
//          If not provided, nothing gets displayed
//    room - room class is in (for seating chart orientation)
//          If not provided, defaults to S182
//    userName - Moodle UserName (name needs to be in associated google spreadsheet workbook.  
//          If not provided, shows seating chart but doesn't accept any input
//
//    e.g: engage.html?class=CS-161-01&room=S181&userName=bobb  (userName is from Moodle: e.g. richa)
//
//  TODO: only enable seat-clicks and Answer Entry tab if valid userID is provided. 

$(document).ready(function() {
	//Note:  all functions are defined inside this function 
	//		 so they all have access to these variables.
	const googleScriptURL="https://script.google.com/macros/s/AKfycbyM43MEJpqpyxzIlWsbcMuuUdSLe6R4yIRkk27TI8EMlTDWcMQ/exec"

	//parameters
	var classSection=getUrlParameter("class");
	var userName=getUrlParameter("userName");
	var room=getUrlParameter("room");
	var password=getUrlParameter("password"); //usually not supplied
	
	//points earned by each students
	var studentPointsArray = [];  // entries look like: {"name": name, "points": points};
	
	//wheel of misfortune (implemented in wheel.js)
	var wheel = new Wheel("canvasWheel");
	wheel.draw();
	

	//=====================END OF TESTING==========================================
	
	
	allowTabsToBeInput('textarea'); //so users can enter tabs in answers

	// --------------------------------------------------------------------
	// dealing with parameters
	
	var errMsg = "";
	//username should match something on server (user Moodle usernames)
	if (userName == undefined) {
		errMsg += "User name wasn't provided, defaulting to anonymous.<br>You can view the seating chart, but not take a seat or submit answers. <br>To fix add a userName parameter to URL (specifying a valid user name)<br>";
		userName="anonymous";
	}
	
	// class (e.g. "CS-161-01") specifies which sheet contains data on server
	if (classSection == undefined) {
		errMsg += "<br>Class (e.g. CS-161-01) wasn't provided. Nothing's going to work.<br>To fix add a class parameter to the URL (specifying a valid class)<br>";
		classSection="";	
	}
	
	// room (e.g. S181, S182, or S183)
	if (room == undefined) {
		errMsg += "<br>Room wasn't provided, defaulting to S182. <br>To fix add a room parameter to the URL (specifying S181, S182, or S183)<br>";
		room="S182";
	} else if (room != "S181" && room != "S182"  && room != "S182x" && room != "S183") {
		errMsg += "<br>invalid room parameter, defaulting to S182. <br>To fix add a room parameter to the URL specifying S181, S182, or S183)<br>";
		room="S182";	
	}
	
	// password is optional, needed only for the instructor, and typically not provided
	if (password == undefined)
		password = "";
	
	//if any parameters were invalid, show the error message.
	if (errMsg != "")
		showErrorDlgBox("Error: missing parameter(s)", errMsg);
	
	// ----------------------------------------------------------------------------
	// page configuration
	
	//modify heading with parameter data
	if (classSection != "")
		$('#Heading h1').html(classSection );
	$('#Heading #info').html("room: " + room );
	
	//build menu (tabs for each content section)
	$( 'section' ).each(function() {
		var menuText = $( this ).data("menutext");
		var contentID = $( this ).attr("id");
		$('<div class="menuItem"></div>')
			.html(menuText)
			.data("contentid", contentID)
			.appendTo("#menu");
		if ( $(this).hasClass("instructor") )
			$(".menuItem:last").addClass("instructor");
	});

	// menu event handler
	$(".menuItem").click( function() {
		var contentID = $( this ).data("contentid");
		$('section').hide();
		$( '#' + contentID ).show();

		$(".menuItem").removeClass('menuItemSelected');
		$( this ).addClass('menuItemSelected');
	});
	
	$(".menuItem:first" ).trigger( "click" );
	$(".instructor").hide();
	
	// Build Seating Chart HTML code (names are added later)
	buildSeatingCharts(room);
		
	//Update seating chart with existing names (from server)
	getData( {'class': classSection }, function( data ) {
		updateSeatingChart( data );
	}); 	
	
	
	//-----------------------------------------------------
	// Password dialog box definition and processing
	
	// Password Dialog box definition
	$( "#dlgPasswordEntry" ).dialog({
		autoOpen: false,
		modal: true,
		width: 400,
		title: "Enter your password",
		overlay: {
			backgroundColor: '#000',
			opacity: 0.5
		},
		buttons: {
			OK: processPasswordDlgBox 
		},
		open: function( event, ui ) {
			$( "#password" ).val(password);
		}
	});
	
	/* password dlgbox box OK button handler*/	
	function processPasswordDlgBox() {
		password=$( "#password" ).val();
		$(this).dialog("close");

		//NOTE: password needs to be sent to getData!!!
		getData( {'class': classSection, 'userName':userName, 'seatNum':"99", 'password': password, 'clearAnswers': true}, function( studentInfoArray ) {
			updateSeatingChart( studentInfoArray );
			//if user was placed into Instructor seat, then credentials were validated.
			var validated=false;
			var ndx=0;
			for (ndx=0;ndx<studentInfoArray.length && validated==false; ndx++)
				if (studentInfoArray[ndx].userName==userName && studentInfoArray[ndx].seat=='99')
					validated = true;
			//if validated, show instructor tabs 
			if ( validated == true) { 
				$('#note').val(studentInfoArray[--ndx].note);				
				$(".instructor").show();
				$(".menuItem:first" ).trigger( "click" );
			} else {
				$(".instructor").hide();
				$('<div>Invalid password.</div>').dialog({
				  modal: true,
				  buttons: {
					Ok: function() {
						$( this ).dialog( "close" );
					} //OK function
				  } //buttons obj
				}); //($<div>).dialog
			} //else
		});
	}
	
	
	//-----------------------------------------------------
	// general handlers (enabled for everyone)
	
	//seat on student view is clicked
	$('#seatingChart .seat').click(function() {
		var seatNum = $(this).attr("data-seatnum");
		
		if (seatNum==99) {
			$( "#dlgPasswordEntry" ).dialog( "open" );
			// data is loaded when OK is pressed: See DialogBox stuff above.
		} else {
			getData( {'class': classSection, 'userName':userName, 'seatNum':seatNum}, function( data ) {
				updateSeatingChart( data );
				//verify givenUserName was in server data (and therefore now on seating chart)
				var nameInList=false;
				for (var ndx=0; ndx<data.length; ndx++) {
					if (data[ndx].userName == userName)
						nameInList=true;
				}
				if (nameInList==false) { 
					var errMsg = "Error: username ("+userName +") is not on classList <br>(please let instructor know).";
					showErrorDlgBox("Error: unknown userName", errMsg);
				}
			});
		};
	});
	
	//update button - update seating chart with current data from server
	$('.btnUpdateChart').click(function() {
		getData( {'class': classSection}, function( data ) {
			updateSeatingChart( data );
		});
	});

	//if answer textarea is modified, erase submit msg
	$('#answer').keyup(function() {
		$('#msgSubmit').html("");
	});
	
	//if answer submit button is clicked, submit answer
	$('#btnSubmitAnswer').click(function() {
		var answer=preSanitize($('#answer').val()); //actual sanitization is done on server
		$('#msgSubmit').html("submitting...");
		getData( {'class': classSection, 'userName':userName, 'answer':answer}, function( data ) {
			updateSeatingChart( data );
			$('#msgSubmit').html("submitted.");
		});
	});
	
	
	//-----------------------------------------------------------
	// instructor event handlers

	// seat on answerview clicked - show that students answer
	$('#answerDisplaySection .seat').click(function() {
		var dataAttrName="data-seatnum";
		var seatNum = $(this).attr(dataAttrName); 
		var selector='#answers *[' + dataAttrName + '="' + seatNum + '"]';
		$(selector).removeClass('hidden');
	});
	
	// getAnswers button is clicked, fetch answers (but don't display)
	$('#btnGetAnswers').click(function() {
		getData( {'class': classSection, 'userName': userName, 'password':password, 'getAnswers': true }, function( data ) {
			updateSeatingChart( data );
			$(".answerSubmitted").removeClass("answerSubmitted");
			$(".answerNotSubmitted").removeClass("answerNotSubmitted");
			loadAnswers( data );
			$('.answer').addClass('hidden');	
		});
	});
	
	// showAnswers button is clicked, fetch answers and display
	$('#btnShowAnswers').click(function() {
		$('.answer').removeClass('hidden');
	});
	
	// award Points button is clicked, accumulate points for checked answers.
	$('#btnAwardPoints').click(function() {
		accumulatePoints();
	});
	
	// Show top 10 students
	$('#btnShowLeaders').click(function() {
		showStudentsWithMostPoints();
	});
	
	// clearAnswers button is clicked, eraseAnswers in database and screen
	$('#btnClearAnswers').click( function() {
		getData( {'class': classSection, 'userName': userName, 'password': password, 'clearAnswers': true }, function( data ) {
			updateSeatingChart( data );
			$("#answers").html("");
			$(".answerSubmitted").removeClass("answerSubmitted");
			$(".answerNotSubmitted").removeClass("answerNotSubmitted");
		});
	});//click
	
	// show author button 
	$('#answers').on("click", ".authorButton", function() {
		if ( $(this).html()=="Author" )
			$(this).html( $(this).attr("data-name") );
		else
			$(this).html("Author");
	});

	// check or remove answer
	$('#answers').on("click", ".checkmarkButton", function() {
		$(this).parent().toggleClass("checked");
	});
	
	// hide answer
	$('#answers').on("click", ".xButton", function() {
		$(this).parent().slideUp();
	});

	// ===========================================================================
	// note functions
	//if answer textarea is modified, erase submit msg
	$('#note').keyup(function() {
		$('#msgSaveNote').html("Data has been modified - save needed!");
	});
	
	// saveNote button is clicked, save note to server
	$('#btnSaveNote').click(function() {
		var note=preSanitize($('#note').val()); //actual sanitization is done on server
		$('#msgSaveNote').html("saving...");
		getData( {'class': classSection, 'userName':userName, 'note':note}, function( data ) {
			updateSeatingChart( data );
			$('#msgSaveNote').html("saved.");
		});		
	});
	
	// ===========================================================================
	// wheel functions
	
	// load all names from server onto wheel
	$('#btnWheelLoadAll').click( function() {
		getData( {'class': classSection }, function( data ) {
			//create sorted list of names
			var aNames = [];
			for (var ndx=0; ndx<data.length; ndx++) {
				var name = (data[ndx].fullName).substring(0,18);
				aNames.push(name);
			}
			aNames.sort();
			buildCheckList(aNames);
			addCheckedNamesToWheel();
		});
	});	
	
	//load top 5 names to wheel
	$('#btnWheelLoadTop').click( function() {
		var numToShow=5;
		var sortedPointsArray=studentPointsArray;
		sortedPointsArray.sort( function(a, b){ return b.points - a.points } ); //high to low
		
		var aNames = [];
		for (var x=0; x<sortedPointsArray.length && x<numToShow; x++) {
			aNames.push(sortedPointsArray[x].name);
			lastPoints=sortedPointsArray[x].points;
		}
		//add anyone tied with #5 to list
		for (; x<sortedPointsArray.length && sortedPointsArray[x].points==lastPoints; x++) {
			aNames.push(sortedPointsArray[x].name);
			lastPoints=sortedPointsArray[x].points;
		}		
		buildCheckList(aNames);
		addCheckedNamesToWheel();
	});
	
	//name checked or unchecked, rebuild wheel
	$('#wheelNameList').on("click", "input", function() {
		addCheckedNamesToWheel();
	});
	
	//create html-formatted list of checkable names
	function buildCheckList(aNames) {
		$('#wheelNameList').html("");
		for (ndx=0; ndx<aNames.length ; ndx++) {
			$('<input type="checkbox" checked="checked">')
				.appendTo('#wheelNameList')
				.attr('value',aNames[ndx])
				.after(aNames[ndx] + "<br>");
		}
	}	
	
	//add checked names to wheel
	function addCheckedNamesToWheel() {
		var nameList="";
		$('#wheelNameList input').each( function(index) {
			if ( $(this).prop('checked') ) {
				nameList+=$(this).attr('value');
				nameList+=";";
			}
		});	
		nameList=nameList.substring(0, nameList.length-1); //remove last ;
		wheel.loadNames(nameList);
	};
	
	$('#btnWheelSpin').click( function() {
		wheel.spin();
	});	

	//=======================================================================
	// award points to the students with "checked" answers.
	// Answers still displayed (those that were wrong should have been deleted by user)
	// will be tallied up.
	function accumulatePoints() {
		//for all answers that are checked, add a point to the student
		var studentCount=0;
		$('#answers .checked').each( function(index) {
			var btn = $(this).find('.authorButton');
			var name =  $(btn).attr('data-name');
	
			//if in array, add 1, else add entire entry to array (as 1)
			var x=0;
			while (x<studentPointsArray.length && studentPointsArray[x].name != name) 
				x++;
			if (x<studentPointsArray.length) 
				studentPointsArray[x].points++;
			else
				studentPointsArray.push({"name": name, "points": 1});
			
			studentCount++;
		});
	
		if (studentCount > 0)
			showErrorDlgBox("Done.", "Points awarded to " + studentCount + " students.");
		else
					if (studentCount == 0)
			showErrorDlgBox("Nothing to do!", "No answers are marked correct.<br>No points awarded!");
	}
	
	//--------------------------------------------------------------------
	function showStudentsWithMostPoints() {
		var numToShow=5;
		var sortedPointsArray=studentPointsArray;
		sortedPointsArray.sort( function(a, b){ return b.points - a.points } ); //high to low
		
		//print out list for testing ----------------
		var studentList="";
		for (var x=0; x<sortedPointsArray.length && x<numToShow; x++) {
			var entry=sortedPointsArray[x];
			studentList+=entry.name + ' (' + entry.points + ')<br>';
		}

		showErrorDlgBox("Top " + numToShow, studentList);	
	}
	
	//=======================================================================
	//update Seating chart
	function buildSeatingCharts(room) {
		var seats182x = [ //seat numbers (as viewed from back; 99="Instructor")
			[  0, 99,   0,    0,  0,  0,  0,   0,  40,  0],
			[  0,  0,   0,    0,  0,  0,  0,   0,   0,  0],
			[  1,  2,   0,    3,  4,  5,  6,   0,   7,  8],
			[  9, 10,   0,   11, 12, 13, 14,   0,  15, 16],
			[ 17, 18,   0,   19, 20, 21, 22,   0,  23, 24],
			[  0,  0,   0,    0,  0,  0,  0,   0,   0,  0],
			[  0,  0,   30,  31, 32, 33, 34,  35,  36, 37]
		];
		
		var seats182 = [ //seat numbers (as viewed from back; 99="Instructor")
			[  0, 99,   0,    0,  0,  0,  0,   0,  0,  0],
			[  0,  0,   0,    0,  0,  0,  0,   0,  0,  0],
			[  1,  2,   0,    3,  4,  5,  6,   0,  7,  8],
			[  9, 10,   0,   11, 12, 13, 14,   0, 15, 16],
			[ 17, 18,   0,   19, 20, 21, 22,   0, 23, 24],
			[  0,  0,   0,    0,  0,  0,  0,   0,  0,  0],
			[  0,  0,   0,    0,  0,  0,  0,   0, 25, 26]
		];
		
		var seats181 = [ //seat numbers (as viewed from back; 99="Instructor")
			[  0,  0,   0,    0,  0,  0,  0,   0,  99,  0],
			[  0,  0,   0,    0,  0,  0,  0,   0,   0,  0],
			[  1,  2,   0,    3,  4,  5,  6,   0,   7,  8],
			[  9, 10,   0,   11, 12, 13, 14,   0,  15, 16],
			[ 17, 18,   0,   19, 20, 21, 22,   0,  23, 24],
			[  0,  0,   0,    0,  0,  0,  0,   0,   0,  0],
			[ 25, 26,   0,    0,  0,  0,  0,   0,   0,  0]
		];		
		
		var seats;
		if (room=="S181" || room=="S183") //181 & 183 have same layout
			seats = seats181;
		else if (room=="S182x")
			seats = seats182x;
		else
			seats = seats182; 
		
		var seatingChartTableID="#seatingChartFromBack";
		for (var row=0; row<seats.length; row++){  
			$(seatingChartTableID).append('<tr></tr>');
			for(var col=0; col<seats[row].length; col++) {
				var seatNum=seats[row][col];
				addTDtoLastTR(seatingChartTableID, seatNum);
			}
		}		

		seatingChartTableID="#seatingChartFromFront";
		for (var row=seats.length-1; row>=0; row--){  
			$(seatingChartTableID).append('<tr></tr>');
			for(var col=seats[row].length-1; col>=0; col--) {
				var seatNum=seats[row][col];
				addTDtoLastTR(seatingChartTableID, seatNum);
			}
		}
	}
	
	//=======================================================================
	function addTDtoLastTR(seatingChartID, seatNum) {
		var className="";
		
		if (seatNum > 0)
			className="seat empty"
		else
			className="isle"

		var tdText = String(seatNum);

		if (seatNum == 0)
			tdText = "";

		$('<td data-seatnum=' + seatNum + '></td>').appendTo(seatingChartID + ' tr:last')
			.html(tdText)
			.addClass(className);
			//note: adding data with data() didn't seem to work....
	}
	
	//=======================================================================
	// get data from server and pass it to callback for processing
	// args:
	//	args - an object (sent to server) containing one or more of the following:
	//		classSection - mandatory
	//		userName - required if seatNum, answer, or clear/getAnswers is given
	//		seatNum - assigns this seat to userName (for instructor seat, username/password requird)
	//		answer - assigns this answer to userName
	//		password (required to sit in instructor seat and for clear/get anwers & note)
	//		clearAnswers - erases answers for all users (user/password required)
	//		getAnswers - returns answers (userName/password required)
	//		note - the note to be saved (userName/password required)
	//	callback - routine to process data (array of student info) returned from ajax call.
	//=======================================================================
	function getData( args, callback ) {
		$('.msgUpdateSeatingChart').html("Processing...");
		$.ajax({
			url: googleScriptURL,
			data: args,
			type: 'POST',
			dataType: 'json'
		})    
		.done(function( studentInfoArray ) {
			callback( studentInfoArray );
			$('.msgUpdateSeatingChart').html(" &nbsp; ");		
		})
		.fail(function( studentInfoArray ){
			$('.msgUpdateSeatingChart').html("Error - reload Page.");
		});
	
	}
	
	//=======================================================================
	// update Seating chart
	// data is an array of objects from getData();
	function updateSeatingChart( studentInfoArray ) {
		//remove any existing names (replacing them with number)
		$('.seat').each( function() {
			var seatNum=$(this).data("seatnum");
			if (seatNum==99)
				seatNum="Instructor";
			$(this)
				.html(seatNum)
				.addClass('empty'); 	
		});
		
		// put names into occupied seats
		for (var ndx=0; ndx<studentInfoArray.length; ndx++) {
			var selector='table *[data-seatnum="' + studentInfoArray[ndx].seat + '"]';
			$(selector)
				.html(studentInfoArray[ndx].fullName)
				.removeClass('empty');
		}		
	}
	
	//=======================================================================
	// load answers
	// data is an array of objects from getData();
	function loadAnswers( studentInfoArray ) {
		$("#answers").html("");
		$(".answerSubmitted").removeClass("answerSubmitted");
		
		studentInfoArray.sort(function(a, b){
			var x = a.answer.toLowerCase();
			var y = b.answer.toLowerCase();
			if (x < y) {return -1;}
			if (x > y) {return 1;}
			return 0;
		});
		
		var count=0;
		for (var ndx=0; ndx<studentInfoArray.length; ndx++)  {
			//selector for seat to mark as submitted/notSubmitted
			var selector='#seatingChartFromFront *[data-seatnum="' + studentInfoArray[ndx].seat + '"]';
			
			if (studentInfoArray[ndx].answer != "") {
				//add answer to list (hidden for now)
				var answer = formatAsHtml(studentInfoArray[ndx].answer);
				var dataAttr='data-seatnum="' + studentInfoArray[ndx].seat + '" ';
				$("#answers").append('<div class="answer hidden"' + dataAttr + '>'
					+ answer
					+ '<button class="xButton">X</button>'
					+ '<button class="checkmarkButton">&#x2713;</button>'
					+ '<button class="authorButton" data-name="' + studentInfoArray[ndx].fullName +'">Author</button>'
					+ '</div>');
				count++;
				//denote seat/user submitted answer
				$(selector).addClass("answerSubmitted"); 
			} else {
				//denote seat/user did not submit answer
				$(selector).addClass("answerNotSubmitted"); 
			}
		}	
		$("#answers").append('<div class="msg"> &nbsp;' + count + 
			' answers retrieved.<br><br><br><br><br><br><br><br><br><br><br></div>');
			//all the <br>'s are so last answer is not at bottom of projector screen.
	}
	
	//========================================================================
	//format as html
	function formatAsHtml(s1) {
		var s2=s1.replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;");
		var s3=s2.replace(/\n/g, "<br>");
		return(s3); 
	}
	
	//========================================================================
	//allow tabs in textarea
	function allowTabsToBeInput(elementSelector) {
		$(document).delegate(elementSelector, 'keydown', function(e) {
			var keyCode = e.keyCode || e.which;

			if (keyCode == 9) {
				e.preventDefault();
				var start = $(this).get(0).selectionStart;
				var end = $(this).get(0).selectionEnd;

				// set textarea value to: text before caret + tab + text after caret
				$(this).val($(this).val().substring(0, start)
					+ "\t"
					+ $(this).val().substring(end));

				// put caret at right position again
				$(this).get(0).selectionStart =
				$(this).get(0).selectionEnd = start + 1;
			}
		});
	}
	
	//========================================================================
	//get specified URL parameter
	function getUrlParameter(sParam) {
		var sPageURL = decodeURIComponent(window.location.search.substring(1)),
			sURLVariables = sPageURL.split('&'),
			sParameterName,
			i;

		for (i = 0; i < sURLVariables.length; i++) {
			sParameterName = sURLVariables[i].split('=');

			if (sParameterName[0] === sParam) {
				return sParameterName[1] === undefined ? true : sParameterName[1];
			}
		}
	}

	//===========================================================================
	function showErrorDlgBox(title, message) {
		$( '<div style="text-align: center"><p>' + message + '</p></div>' ).dialog({
			'modal': true,
			'width': 600,
			'title': title,
			'buttons': {
				'OK': function() {
					$( this ).dialog( "close" );
				} //OK function
			} //buttons
		}); //dialog
	}
	
	//================================================================================
	function preSanitize(str) {
		// characters to replace, followed by replacement values.
		var swapFromTo = [
		"<", 	"&lt;",
		">",	"&gt;"
		];
		
		var newStr=str;
		for(var x=0; x<swapFromTo.length; x+=2) {
			var find = swapFromTo[x];
			var regex = new RegExp(find, "g");
			newStr=newStr.replace(regex, swapFromTo[x+1]);
		}
		
		return newStr;
	}
});
