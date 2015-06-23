/*
 * NASA Worldview
 *
 * This code was originally developed at NASA/Goddard Space Flight Center for
 * the Earth Science Data and Information System (ESDIS) project.
 *
 * Copyright (C) 2013 - 2014 United States Government as represented by the
 * Administrator of the National Aeronautics and Space Administration.
 * All Rights Reserved.
 */

var wv = wv || {};

wv.events = wv.events || function(models, ui) {

    var layerLists = {
        Wildfires: [
            ["MODIS_Aqua_CorrectedReflectance_TrueColor", false],
            ["MODIS_Terra_CorrectedReflectance_TrueColor", true],
            ["MODIS_Fires_All", true]
        ],
        Floods: [
            ["MODIS_Aqua_SurfaceReflectance_Bands121", false],
            ["MODIS_Terra_SurfaceReflectance_Bands121", true]
        ],
        Default: [
            ["MODIS_Aqua_CorrectedReflectance_TrueColor", false],
            ["MODIS_Terra_CorrectedReflectance_TrueColor", true],
        ]
    };

    var self = {};
    self.selector = "#wv-data";
    self.id = "wv-data";
    self.data = {};
    var lastIndex = -1;
    var lastDateIndex = -1;

    var init = function() {
        self.render();
        self.query();
    };

    self.render = function() {
        var $panels = $(self.selector).empty();

        var $listContainer = $("<div></div>")
            .attr("id", "wv-events-list")
            .addClass(self.id + "list")
            .addClass("bank")
            .addClass("selector");

        var $list = $("<div></div>")
            .attr("id", self.id + "content")
            .addClass("content");

        $listContainer.append($list);
        $panels.append($listContainer);

        var $detailContainer = $("<div></div>")
            .attr("id", "wv-events-detail")
            .hide();
        $panels.append($detailContainer);

        self.refresh();
    };

    self.refresh = function() {
        var $content = $(self.selector + "content");
        var api = $content.data("jsp");
        if ( api ) {
            api.destroy();
        }
        $content = $(self.selector + "content").empty();
        _.each(self.data, function(event, index) {
            refreshEvent($content, event, index);
        });
        $(self.selector + "content li").click(function() {
            showEvent($(this).attr("data-index"));
        });
        $(self.selector + "content a.date").click(function(event) {
            showEvent($(this).attr("data-index"), $(this).attr("data-date-index"));
            event.stopPropagation();
        });
        resize();
    };

    var refreshEvent = function($content, event, index) {
        var $item = $("<li></li>")
            .addClass("selectorItem")
            .addClass("item")
            .attr("data-index", index);
        var $title = $("<h4></h4>")
            .addClass("title")
            .html(event.title);
        var $subtitle = $("<p></p>")
            .addClass("subtitle")
            .html(event.description)
            .hide();

        var $dates = $("<ul></ul>").addClass("dates").hide();
        if ( event.geometry.length > 1 ) {
            _.each(event.geometry, function(geometry, dateIndex) {
                date = geometry.date.split(/T/)[0];
                $date = $("<a></a>")
                    .addClass("date")
                    .attr("data-date-index", dateIndex)
                    .attr("data-index", index)
                    .html("&bull; " + date);
                $dates.append($("<li class='dates'></li>").append($date));
            });
        }

        $item.append($title).append($subtitle).append($dates);
        $content.append($item);
    };

    var eventList = function(events) {
        _.each(events, function(event) {
            $("#wv-data").append(createEvent(event));
        });
        $("#wv-data").jScrollPane();
    };

    var showEvent = function(index, dateIndex) {
        if ( index === lastIndex && lastDateIndex === dateIndex ) {
            return;
        }

        var method = "fly";
        if ( index == lastIndex && dateIndex != lastDateIndex ) {
            method = "pan";
        }
        lastIndex = index;
        lastDateIndex = lastDateIndex;

        $("#wv-events-list .subtitle").hide();
        $("#wv-events-list .dates").hide();
        $("#wv-events-list [data-index='" + index + "'] .subtitle").show();
        $("#wv-events-list [data-index='" + index + "'] .dates").show();
        resize();

        event = self.data[index];
        console.log("event", event);
        eventItem = null;
        if ( event.geometry.length > 1 ) {
            eventItem = event.geometry[dateIndex || 0];
        } else {
            eventItem = event.geometry;
        }
        eventDate = wv.util.parseTimestampUTC(eventItem.date);
        models.date.select(eventDate);

        category = "Default";
        categories = event["category"]
        if ( categories.constructor !== Array ) {
            categories = [categories];
        }
        _.each(categories, function(c) {
            if ( layerLists[c["#text"]] ) {
                category = c["#text"];
                return;
            }
        });

        layers = layerLists[category];
        if ( !layers ) {
            layers = layerLists["Default"];
        }
        models.layers.clear();
        _.each(layers, function(layer) {
            var id = layer[0];
            var visible = layer[1];
            models.layers.add(id, { visible: visible });
        });

        if ( eventItem.type === "Point" ) {
            goTo(method, eventItem.coordinates);
        } else if ( eventItem.type === "Polygon" && eventItem.coordinates.length == 4 ) {
            c = eventItem.coordinates;
            var extent = [c[1][0], c[0][0], c[3][0], c[2][0]];
            goTo(method, extent);
        }
    };

    var goTo = function(method, location) {
        var zoom = 4;
        var map = ui.map.selected;
        var duration = ( method == "fly" ) ? 5000 : 1000;
        var wait = ( method == "fly" ) ? 1000 : 1;
        var start = +new Date();
        var pan = ol.animation.pan({
            duration: duration,
            source: map.getView().getCenter(),
            start: start
        });
        var bounce = ol.animation.bounce({
            duration: duration,
            resolution: models.proj.selected.resolutions[zoom],
            start: start
        });

        setTimeout(function() {
            if ( method === "fly" ) {
                map.beforeRender(pan, bounce);
            } else {
                map.beforeRender(pan);
            }
            if ( location.length == 2 ) {
                map.getView().setCenter(location);
                map.getView().setZoom(5);
            } else {
                map.getView().fitExtent(location, map.getSize());
            }
        }, wait);
    };

    var resize = function() {
        resizePane($(self.selector + "content"));
    };

    var resizePane = function($pane) {
        var tabs_height = $(".ui-tabs-nav").outerHeight(true);
        //var button_height = $(self.selector + "_Button").outerHeight(true);
        $(self.selector).height(
            $(self.selector).parent().outerHeight()// - tabs_height// - button_height
        );
        var api = $pane.data("jsp");
        if ( !wv.util.browser.small ) {
            if ( api ) {
                api.reinitialise();
            } else {
                $pane.jScrollPane({verticalGutter:0, contentWidth:238, autoReinitialise:false});
            }
        } else {
            if ( api ) {
                api.destroy();
            }
        }
    };

    self.query = function() {
        $.getJSON("service/events/eo-net.cgi?path=/api/v1/events", function(data) {
            self.data = data.item;
            console.log("data received", self.data);
            self.refresh();
        });
    };

    init();
    return self;

};
